import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { getOrCreateBookingSystemActor } from '@/lib/booking-engine/system-actor';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { sendBookingConfirmedEmail, sendPaymentReceiptEmail, sendBookingRefundCompletedEmail } from '@/lib/email/booking-emails';
import { sendBookingPaymentFailedEmail } from '@/lib/email/booking-emails';
import { getBookingPaymentAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { decryptPaymentCredential } from '@/lib/payment-providers/credentials';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { postBookingAdvanceDeposit } from '@/lib/booking-engine/financial-service';
import { settleCorporateAdvancePayment, settleCorporateInvoicePayment, settleCorporatePayment } from '@/lib/booking-engine/corporate-settlement-service';
import { reconcileFlutterwaveRefund } from '@/lib/booking-engine/flutterwave-refund-reconciliation';
import { NotificationEngine } from '@/lib/notification-engine';
import { getFlutterwaveTransfer } from '@hotel-pms/db';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import type { TenantContext } from '@/lib/organization-access';

function validFlutterwaveSignature(
  rawBody: string,
  signatures: Array<string | null | undefined>,
  additionalSecrets: Array<string | null | undefined> = [],
) {
  const secrets = additionalSecrets
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return signatures.some((signature) => {
    const candidate = signature?.trim();
    return Boolean(candidate && secrets.some((secret) => new FlutterwaveProvider('signature-check', secret).validateWebhookSignature(rawBody, candidate)));
  });
}

async function refundLateBookingPayment(input: {
  bpt: any;
  providerSecret: string;
  providerTxId: string;
  amount: number;
  currency: string;
}) {
  const idempotencyKey = `late_booking_payment_refund:${input.bpt.id}`;
  let refund = await prisma.refund.findUnique({ where: { idempotencyKey } });
  if (refund && refund.status !== 'FAILED') return refund;

  const [property, actorId] = await Promise.all([
    prisma.property.findUnique({ where: { id: input.bpt.propertyId }, select: { businessDate: true } }),
    getOrCreateBookingSystemActor(prisma as any, input.bpt.organizationId),
  ]);
  if (!property) throw new Error(`Property ${input.bpt.propertyId} was not found for late payment refund`);

  const refundRecord = refund
    ? await prisma.refund.update({ where: { id: refund.id }, data: { status: 'PROCESSING' } })
    : await prisma.refund.create({
      data: {
        propertyId: input.bpt.propertyId,
        bookingPaymentTransactionId: input.bpt.id,
        amount: input.amount,
        currency: input.currency,
        method: 'ORIGINAL_PAYMENT',
        reason: 'Payment received after reservation payment window expired.',
        authorizedBy: actorId,
        status: 'PROCESSING',
        businessDate: property.businessDate ?? new Date(),
        idempotencyKey,
      },
    });

  try {
    const provider = input.bpt.provider === 'FLUTTERWAVE'
      ? new FlutterwaveProvider(input.providerSecret)
      : new PaystackProvider(input.providerSecret);
    const result = await provider.refundTransaction(input.providerTxId, input.amount, input.currency, 'Late payment received after reservation expiry');
    return await prisma.refund.update({
      where: { id: refundRecord.id },
      data: {
        status: result.status,
        providerRefundId: result.providerRefundId ?? null,
      },
    });
  } catch (error) {
    await prisma.refund.update({ where: { id: refundRecord.id }, data: { status: 'FAILED' } });
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  if (isFlutterwaveRefundEvent(event)) {
    return handleFlutterwaveRefundWebhook(req, rawBody, event);
  }

  if (isFlutterwaveTransferEvent(event)) {
    return handleFlutterwaveTransferWebhook(req, rawBody, event);
  }

  if (event.event !== 'charge.success' && event.event !== 'charge.completed') {
    return new NextResponse('OK', { status: 200 });
  }

  const providerRef: string = event.data?.reference ?? event.data?.tx_ref;
  if (!providerRef) return new NextResponse('OK', { status: 200 });

  const bpt = await prisma.bookingPaymentTransaction.findFirst({
    where: { providerRef },
  });

  if (!bpt) {
    return new NextResponse('OK', { status: 200 });
  }

  const notifyPaymentFailure = async (amount: number, currency: string) => {
    if (!bpt.reservationId) return;
    const failedReservation = await prisma.reservation.findUnique({
      where: { id: bpt.reservationId },
      include: { primaryGuest: { select: { email: true } } },
    });
    if (!failedReservation?.primaryGuest.email) return;
    await sendBookingPaymentFailedEmail({
      to: failedReservation.primaryGuest.email,
      propertyName: (await prisma.property.findUnique({ where: { id: bpt.propertyId }, select: { name: true } }))?.name ?? 'the property',
      confirmationNumber: failedReservation.confirmationNumber,
      amount,
      currency,
    }).catch((emailError) => console.error('[Booking Webhook] failure email failed', emailError));
  };

  const paymentTarget = (bpt.metadata as any)?.paymentTarget === 'STANDALONE_API' ? 'STANDALONE_API' : 'BOOKING_ENGINE';
  const account = await getBookingPaymentAccount(bpt.propertyId, paymentTarget);
  let providerSecret: string;
  let webhookSecret: string;
  try {
    providerSecret = account?.secret ?? resolveSecretRef(account?.secretRef, bpt.provider === 'FLUTTERWAVE' ? 'FLW_SECRET_KEY' : 'PAYSTACK_SECRET_KEY');
    webhookSecret = account?.webhookSecret ?? resolveSecretRef(account?.webhookSecretRef || account?.secretRef, bpt.provider === 'FLUTTERWAVE' ? 'FLW_WEBHOOK_SECRET_HASH' : 'PAYSTACK_SECRET_KEY');
  } catch {
    return new NextResponse('Payment provider is not configured', { status: 503 });
  }

  const flutterwaveSignature = req.headers.get('flutterwave-signature')?.trim() ?? '';
  const flutterwaveLegacySignature = req.headers.get('verif-hash')?.trim() ?? '';
  const validSignature = bpt.provider === 'FLUTTERWAVE'
    ? (() => {
      // Flutterwave currently supports HMAC-SHA256 (`flutterwave-signature`)
      // and the legacy plain secret hash (`verif-hash`). Accept either valid
      // header independently because some dashboard/manual deliveries include
      // both headers.
      return validFlutterwaveSignature(
        rawBody,
        [flutterwaveSignature, flutterwaveLegacySignature],
        [webhookSecret],
      );
    })()
    : (() => {
      const signature = req.headers.get('x-paystack-signature') ?? '';
      const expected = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
      return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    })();
  if (!validSignature) return new NextResponse('Forbidden', { status: 403 });

  const lateRefundStatus = (bpt.metadata as any)?.refundStatus;
  if ((bpt.webhookVerified && !(bpt.status === 'SUCCESSFUL_LATE' && lateRefundStatus === 'FAILED')) || ['SUCCESS', 'REFUNDED'].includes(bpt.status)) {
    return new NextResponse('OK', { status: 200 });
  }

  let verifiedAmount: number;
  let verifiedCurrency: string;
  let providerTxId: string;

  try {
    if (bpt.provider === 'FLUTTERWAVE') {
      const verified = await new FlutterwaveProvider(providerSecret, webhookSecret).verifyTransaction(providerRef);
      if (!verified.isSuccessful) throw new Error('Flutterwave transaction was not successful');
      verifiedAmount = verified.amount;
      verifiedCurrency = verified.currency;
      providerTxId = verified.providerTransactionId;
    } else {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(providerRef)}`,
        { headers: { Authorization: `Bearer ${providerSecret}` } }
      );
      const verifyData = await verifyRes.json();
      if (!verifyData.status || verifyData.data?.status !== 'success') {
      await prisma.bookingPaymentTransaction.update({
        where: { id: bpt.id },
        data: { status: 'FAILED', webhookVerified: true, webhookPayload: event },
      });
      await notifyPaymentFailure(Number(bpt.amount), bpt.currency);
      return new NextResponse('OK', { status: 200 });
      }
      verifiedAmount = verifyData.data.amount / 100;
      verifiedCurrency = verifyData.data.currency;
      providerTxId = String(verifyData.data.id);
    }
    if (Math.abs(verifiedAmount - Number(bpt.amount)) > 0.01 || verifiedCurrency.toUpperCase() !== bpt.currency.toUpperCase()) {
      await prisma.bookingPaymentTransaction.update({
        where: { id: bpt.id },
        data: { status: 'FAILED', webhookVerified: true, webhookPayload: event, metadata: { reason: 'AMOUNT_OR_CURRENCY_MISMATCH', verifiedAmount, verifiedCurrency } as any },
      });
      await notifyPaymentFailure(verifiedAmount, verifiedCurrency);
      return new NextResponse('OK', { status: 200 });
    }

    const reservation = bpt.reservationId
      ? await prisma.reservation.findUnique({
        where: { id: bpt.reservationId },
        select: { status: true, paymentExpiresAt: true, confirmationNumber: true, primaryGuest: { select: { email: true } }, property: { select: { name: true } } },
      })
      : null;
    const isExtension = (bpt.metadata as any)?.type === 'EXTENSION';
    const isInvoicePayment = (bpt.metadata as any)?.invoicePayment === true;
    const isLatePayment = !isInvoicePayment && !isExtension && (!reservation || !['PENDING', 'CONFIRMED'].includes(reservation.status) || Boolean(reservation.paymentExpiresAt && reservation.paymentExpiresAt <= new Date()));
    if (isLatePayment) {
      let refundStatus = 'FAILED';
      let providerRefundId: string | null = null;
      try {
        const refund = await refundLateBookingPayment({ bpt, providerSecret, providerTxId, amount: verifiedAmount, currency: verifiedCurrency });
        refundStatus = refund.status;
        providerRefundId = refund.providerRefundId ?? null;
        if (refundStatus === 'COMPLETED' && reservation?.primaryGuest.email) {
          await sendBookingRefundCompletedEmail({
            to: reservation.primaryGuest.email,
            propertyName: reservation.property.name,
            confirmationNumber: reservation.confirmationNumber,
            amount: verifiedAmount,
            currency: verifiedCurrency,
            method: 'ORIGINAL_PAYMENT',
          });
        }
      } catch (refundError) {
        console.error('[Booking Webhook] late payment refund failed:', refundError);
      }

      await prisma.bookingPaymentTransaction.update({
        where: { id: bpt.id },
        data: {
          status: refundStatus === 'COMPLETED' ? 'REFUNDED' : 'SUCCESSFUL_LATE',
          providerTxId,
          webhookVerified: true,
          webhookPayload: event,
          metadata: {
            ...((bpt.metadata as any) || {}),
            latePayment: true,
            refundStatus,
            providerRefundId,
          } as any,
        },
      });
      return new NextResponse('OK', { status: 200 });
    }
  } catch (err) {
    console.error(`[Booking Webhook] ${bpt.provider} verify failed:`, err);
    // A provider 5xx is transient. Return non-2xx so Flutterwave/Paystack
    // retries the signed webhook instead of permanently acknowledging a
    // payment that is still pending local verification.
    if (err instanceof Error && /\((?:500|502|503|504)\)/.test(err.message)) {
      return NextResponse.json({ error: 'Payment provider temporarily unavailable' }, { status: 503 });
    }
    return new NextResponse('OK', { status: 200 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if ((bpt.metadata as any)?.channel === 'CORPORATE_API') {
        const property = await tx.property.findUnique({
          where: { id: bpt.propertyId },
          select: { businessDate: true, timezone: true, organizationId: true },
        });
        if (!property) throw new Error(`Property ${bpt.propertyId} was not found for corporate settlement`);
        const systemActorId = await getOrCreateBookingSystemActor(
          prisma as any,
          property.organizationId,
        );
        const settlementInput = {
          tx,
          bookingPaymentTransactionId: bpt.id,
          providerRef,
          providerTransactionId: providerTxId,
          verifiedAmount,
          verifiedCurrency,
          businessDate: property.businessDate ?? getPropertyBusinessDate(property.timezone ?? 'UTC'),
          systemActorId,
          requestId: crypto.randomUUID(),
        };
        if ((bpt.metadata as any)?.walletCredit) await settleCorporateAdvancePayment(settlementInput);
        else if ((bpt.metadata as any)?.invoicePayment) await settleCorporateInvoicePayment(settlementInput);
        else await settleCorporatePayment(settlementInput);
        return;
      }

      const reservation = await (tx as any).reservation.findFirst({
        where: { id: bpt.reservationId, propertyId: bpt.propertyId },
        include: {
          folios: {
            where: { type: 'ROOM', status: 'OPEN' },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          property: { select: { businessDate: true, timezone: true, organizationId: true } },
        },
      });

      if (!reservation || !reservation.folios[0]) {
        throw new Error(`No open ROOM folio found for reservation ${bpt.reservationId}`);
      }

      const folio = reservation.folios[0];
      const property = reservation.property;
      const businessDate =
        property.businessDate ?? getPropertyBusinessDate(property.timezone ?? 'UTC');

      const extension = (bpt.metadata as any)?.type === 'EXTENSION' ? (bpt.metadata as any) : null;
      if (!extension && !['PENDING', 'CONFIRMED'].includes(reservation.status)) {
        throw new Error(`Reservation is no longer payable: ${reservation.status}`);
      }
      // Claim a pending reservation before creating its payment. The expiry
      // cron uses the same conditional state transition, preventing a late
      // payment from confirming an already-expired reservation.
      if (!extension && reservation.status === 'PENDING') {
        const claimed = await (tx as any).reservation.updateMany({ where: { id: reservation.id, status: 'PENDING' }, data: { status: 'CONFIRMED' } });
        if (claimed.count !== 1) throw new Error('Reservation confirmation race');
      }

      const systemActorId = await getOrCreateBookingSystemActor(
        prisma as any,
        property.organizationId
      );

      const payment = await postBookingAdvanceDeposit({
        tx,
        folio,
        reservation,
        property,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        provider: bpt.provider as 'PAYSTACK' | 'FLUTTERWAVE',
        providerRef,
        providerTransactionId: providerTxId,
        businessDate,
        systemActorId,
      });

      if (extension) {
        const newCheckOut = new Date(`${extension.newCheckOut}T00:00:00Z`);
        if (newCheckOut <= new Date(reservation.checkOut)) throw new Error('Extension check-out is no longer valid');
        const currentSnapshot = (reservation.ratePlanSnapshot as any) ?? {};
        await (tx as any).reservation.update({
          where: { id: reservation.id },
          data: {
            checkOut: newCheckOut,
            ratePlanSnapshot: {
              ...currentSnapshot,
              nights: Number(currentSnapshot.nights ?? 0) + Number(extension.additionalNights ?? 0),
              subtotal: Number(currentSnapshot.subtotal ?? 0) + verifiedAmount,
              total: Number(currentSnapshot.total ?? currentSnapshot.subtotal ?? 0) + verifiedAmount,
              capturedAt: new Date().toISOString(),
            },
          },
        });
        await (tx as any).reservationRoom.updateMany({ where: { reservationId: reservation.id, status: 'ACTIVE' }, data: { checkOut: newCheckOut } });
        // The extension is an advance payment for future nights. Night Audit
        // will create one ROOM_CHARGE folio item per stayed night and include
        // both the room revenue and payment in its single daily GL journal.
      }

      await (tx as any).reservation.update({
        where: { id: reservation.id },
        data: { status: 'CONFIRMED', paymentExpiresAt: null },
      });

      // Payment completes the booking-hold lifecycle. Until this point the
      // hold remains ACTIVE so the expiry cron can safely expire unpaid
      // pending reservations.
      if (reservation.bookingChannelRef) {
        await (tx as any).bookingHold.updateMany({
          where: { id: reservation.bookingChannelRef, status: 'ACTIVE' },
          data: { status: 'CONVERTED' },
        });
      }

      await (tx as any).bookingPaymentTransaction.update({
        where: { id: bpt.id },
        data: {
          status: 'SUCCESS',
          providerTxId,
          webhookVerified: true,
          webhookPayload: event,
          paymentId: payment.id,
        },
      });

      await (tx as any).auditLog.create({
        data: {
          organizationId: property.organizationId,
          propertyId: bpt.propertyId,
          userId: systemActorId,
          userEmail: 'booking.system@lodgecore.internal',
          userRole: 'SYSTEM',
          action: 'PAYMENT_COMPLETED',
          resource: 'Payment',
          resourceId: payment.id,
          newValue: {
            amount: verifiedAmount,
            currency: verifiedCurrency,
            provider: bpt.provider,
            providerRef,
            reservationId: reservation.id,
            source: 'PUBLIC_API',
          },
          ipAddress: '0.0.0.0',
          userAgent: `${bpt.provider}-Webhook`,
          requestId: crypto.randomUUID(),
        },
      });
    });

    const paidReservation = await prisma.reservation.findUnique({
      where: { id: bpt.reservationId! },
      select: {
        confirmationNumber: true,
        currency: true,
        checkIn: true,
        checkOut: true,
        adults: true,
        children: true,
        ratePlanSnapshot: true,
        property: { select: { name: true } },
        primaryGuest: { select: { email: true, firstName: true } },
        reservationRooms: { where: { status: 'ACTIVE' }, include: { room: { select: { number: true } } } },
        folios: { where: { type: 'ROOM' }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true } },
      },
    });
    if (paidReservation?.folios[0]) {
      NotificationEngine.emit({
        type: 'PAYMENT_RECEIVED',
        organizationId: bpt.organizationId,
        propertyId: bpt.propertyId,
        entityType: 'folio',
        entityId: paidReservation.folios[0].id,
        idempotencyKey: `booking_payment_${bpt.id}`,
        metadata: {
          notificationType: 'PAYMENT_RECEIVED',
          amount: verifiedAmount,
          currency: verifiedCurrency,
          method: bpt.provider === 'FLUTTERWAVE' ? 'FLUTTERWAVE_ONLINE' : 'PAYSTACK_ONLINE',
          source: 'BOOKING_ENGINE',
        },
      }).catch((e: any) => console.error('[Booking Webhook] payment notification failed:', e));
    }
    if (paidReservation?.primaryGuest.email) {
      const snapshot = (paidReservation.ratePlanSnapshot as any) ?? {};
      const roomNumber = paidReservation.reservationRooms[0]?.room?.number;
      await sendBookingConfirmedEmail({
        to: paidReservation.primaryGuest.email,
        firstName: paidReservation.primaryGuest.firstName,
        propertyName: paidReservation.property.name,
        confirmationNumber: paidReservation.confirmationNumber,
        checkIn: paidReservation.checkIn,
        checkOut: paidReservation.checkOut,
        roomTypeName: snapshot.roomTypeName ?? 'Room',
        roomNumber,
        adults: paidReservation.adults,
        children: paidReservation.children,
        currency: paidReservation.currency,
        total: Number(snapshot.subtotal ?? verifiedAmount),
      }).catch((e) => console.error('[Booking Webhook] confirmation email failed', e));
      await sendPaymentReceiptEmail({ to: paidReservation.primaryGuest.email, propertyName: paidReservation.property.name, confirmationNumber: paidReservation.confirmationNumber, amount: verifiedAmount, currency: verifiedCurrency, roomNumber: paidReservation.reservationRooms[0]?.room?.number }).catch((e) => console.error('[Booking Webhook] receipt email failed', e));
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('[Booking Webhook] Failed to post payment:', err);
    await prisma.bookingPaymentTransaction.update({
      where: { id: bpt.id },
      data: {
        status: 'FAILED',
        webhookPayload: event,
        metadata: { error: err.message } as any,
      },
    }).catch(() => null);
    await notifyPaymentFailure(Number(bpt.amount), bpt.currency);
    return new NextResponse('OK', { status: 200 });
  }
}

function isFlutterwaveTransferEvent(event: any): boolean {
  const eventName = String(event?.event || event?.type || '').toLowerCase();
  return eventName.includes('transfer') || String(event?.data?.event?.type || '').toLowerCase() === 'transfer';
}

function transferStatus(status: unknown): 'SUCCESSFUL' | 'FAILED' | 'PROCESSING' {
  const normalized = String(status || '').toUpperCase();
  if (['SUCCESSFUL', 'COMPLETED', 'SUCCESS'].includes(normalized)) return 'SUCCESSFUL';
  if (['FAILED', 'CANCELLED', 'CANCELED'].includes(normalized)) return 'FAILED';
  return 'PROCESSING';
}

async function getPropertyFlutterwaveCredentials(propertyId: string, target?: string) {
  const account = await prisma.bookingPaymentAccount.findFirst({
    where: {
      propertyId,
      provider: 'FLUTTERWAVE',
      mode: 'CUSTOMER',
      isActive: true,
      ...(target ? { target } : {}),
    },
    select: { secretCiphertext: true, secretRef: true, webhookSecretCiphertext: true, webhookSecretRef: true },
  });
  if (!account) return null;
  const secretKey = account.secretCiphertext
    ? decryptPaymentCredential(account.secretCiphertext)
    : resolveSecretRef(account.secretRef, 'FLW_SECRET_KEY');
  const webhookSecret = account.webhookSecretCiphertext
    ? decryptPaymentCredential(account.webhookSecretCiphertext)
    : resolveSecretRef(account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH');
  return { secretKey, webhookSecret };
}

async function handleFlutterwaveTransferWebhook(req: NextRequest, rawBody: string, event: any) {
  const data = event?.data || {};
  const reference = String(data.reference || data.tx_ref || '').trim();
  if (!reference) return new NextResponse('OK', { status: 200 });

  const [payroll, reach, reimbursement] = await Promise.all([
    prisma.payrollPayout.findUnique({ where: { providerReference: reference } }),
    prisma.referralPayout.findFirst({ where: { payoutReference: reference } }),
    prisma.expenseClaim.findFirst({ where: { paymentReference: reference, autoPaymentStatus: { in: ['PROCESSING', 'SUCCESSFUL'] } }, select: { id: true, propertyId: true, amount: true, currency: true, paymentReference: true } }),
  ]);
  if (!payroll && !reach && !reimbursement) return new NextResponse('OK', { status: 200 });
  if ([payroll, reach, reimbursement].filter(Boolean).length > 1) return new NextResponse('Conflicting payout reference', { status: 409 });

  const propertyId = payroll?.propertyId || reach?.propertyId || reimbursement!.propertyId;
  let credentials: { secretKey: string; webhookSecret: string } | null;
  try {
    credentials = await getPropertyFlutterwaveCredentials(propertyId, payroll || reimbursement ? 'PAYROLL' : undefined);
  } catch (error) {
    console.error('[Public Payment Webhook] payout credentials unavailable', { propertyId, error });
    return new NextResponse('Payment provider is not configured', { status: 503 });
  }
  if (!credentials) return new NextResponse('Payment provider is not configured', { status: 503 });

  const signature = req.headers.get('flutterwave-signature')?.trim() || '';
  const legacySignature = req.headers.get('verif-hash')?.trim() || '';
  if (!validFlutterwaveSignature(rawBody, [signature, legacySignature], [credentials.webhookSecret])) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const transferId = String(data.id || data.transfer_id || payroll?.providerTransferId || '').trim();
  if (!transferId) return new NextResponse('OK', { status: 200 });

  let transfer;
  try {
    transfer = await getFlutterwaveTransfer(credentials.secretKey, transferId);
  } catch (error) {
    console.error('[Public Payment Webhook] transfer verification failed', { reference, transferId, error });
    return new NextResponse('OK', { status: 200 });
  }
  if (String(transfer.reference || '') !== reference) return new NextResponse('Transfer reference mismatch', { status: 409 });

  const status = transferStatus(transfer.status);
  const failureReason = status === 'FAILED' ? (transfer.complete_message || `Flutterwave status: ${transfer.status}`).slice(0, 500) : null;
  if (reimbursement) {
    if (Math.abs(Number(transfer.amount) - Number(reimbursement.amount)) > 0.01 || String(transfer.currency).toUpperCase() !== reimbursement.currency.toUpperCase()) {
      return new NextResponse('Transfer amount or currency mismatch', { status: 409 });
    }
    if (status === 'SUCCESSFUL') {
      try {
        await settleEmployeeReimbursement(reimbursement.id, reference);
      } catch (error) {
        console.error('[Public Payment Webhook] reimbursement settlement failed', { reimbursementId: reimbursement.id, error });
        return new NextResponse('Reimbursement reconciliation unavailable', { status: 503 });
      }
    } else if (status === 'FAILED') {
      await prisma.expenseClaim.updateMany({ where: { id: reimbursement.id, autoPaymentStatus: 'PROCESSING' }, data: { autoPaymentStatus: 'FAILED' } });
    }
    return new NextResponse('OK', { status: 200 });
  }

  if (payroll) {
    if (Math.abs(Number(transfer.amount) - Number(payroll.amount)) > 0.01 || String(transfer.currency).toUpperCase() !== payroll.currency.toUpperCase()) {
      return new NextResponse('Transfer amount or currency mismatch', { status: 409 });
    }
    await prisma.payrollPayout.update({
      where: { id: payroll.id },
      data: {
        providerTransferId: transferId,
        providerStatus: transfer.status,
        status,
        failureReason,
        completedAt: status === 'PROCESSING' ? null : new Date(),
        rawResponse: { id: transfer.id, reference: transfer.reference, status: transfer.status, amount: transfer.amount, currency: transfer.currency, source: 'PUBLIC_PAYMENT_WEBHOOK' },
      },
    });
    await settlePayrollPeriodIfComplete(payroll.payrollPeriodId);
  } else {
    if (Math.abs(Number(transfer.amount) - Number(reach!.amount)) > 0.01 || String(transfer.currency).toUpperCase() !== reach!.currency.toUpperCase()) {
      return new NextResponse('Transfer amount or currency mismatch', { status: 409 });
    }
    await prisma.$transaction(async (tx) => {
      const current = await tx.referralPayout.findUnique({ where: { id: reach!.id } });
      if (!current) return;
      const alreadyTerminal = ['PAID', 'FAILED'].includes(current.status);
      await tx.referralPayout.update({
        where: { id: current.id },
        data: { status: status === 'SUCCESSFUL' ? 'PAID' : status === 'FAILED' ? 'FAILED' : 'PROCESSING', processedAt: status === 'PROCESSING' ? null : new Date(), failureReason },
      });
      if (status === 'FAILED' && !alreadyTerminal) {
        const wallet = await tx.referralPartnerPropertyWallet.findUnique({ where: { partnerId_propertyId: { partnerId: current.partnerId, propertyId: current.propertyId } } });
        if (wallet) {
          await tx.$queryRaw`SELECT id FROM "ReferralPartnerPropertyWallet" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
          const balance = Number(wallet.availableBalance) + Number(current.amount);
          await tx.referralPartnerPropertyWallet.update({ where: { id: wallet.id }, data: { availableBalance: balance } });
          await tx.referralPartnerPropertyWalletTransaction.create({ data: { walletId: wallet.id, partnerId: current.partnerId, propertyId: current.propertyId, payoutId: current.id, type: 'WITHDRAWAL_RELEASE', amount: current.amount, balanceAfter: balance, currency: current.currency, idempotencyKey: `REACH_PARTNER_PROPERTY_WITHDRAWAL_RELEASE:${current.id}`, completedAt: new Date(), metadata: { source: 'PUBLIC_PAYMENT_WEBHOOK', reason: failureReason } } });
        }
      }
    });
  }
  return new NextResponse('OK', { status: 200 });
}

async function getReimbursementSystemUser(organizationId: string, tx: any) {
  const email = `reimbursement.system+${organizationId}@lodgecore.internal`;
  const user = await tx.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: `SYSTEM_ONLY:${crypto.randomBytes(32).toString('hex')}`,
      membership: { create: { organizationId, role: 'SYSTEM', status: 'ACTIVE', permissions: [] } },
    },
    select: { id: true },
  });
  return user.id;
}

async function ensureReimbursementCashControls(tx: any, propertyId: string) {
  for (const definition of [
    { type: 'SAFE', name: 'General Cashier Safe', aliases: ['Reception Safe'] },
    { type: 'CASH_IN_TRANSIT', name: 'Cash in Transit', aliases: ['Pending Bank Deposits'] },
  ]) {
    const existing = await tx.cashAccount.findFirst({ where: { propertyId, OR: [{ type: definition.type }, { name: definition.name }, { name: { in: definition.aliases } }] } });
    if (!existing) await tx.cashAccount.create({ data: { propertyId, name: definition.name, type: definition.type, balance: 0, isActive: true } });
  }
}

async function ensureReimbursementClearingAccount(tx: any, propertyId: string) {
  return (await tx.cashAccount.findFirst({ where: { propertyId, type: 'EXTERNAL', name: 'Cash Expense Clearing' } }))
    || tx.cashAccount.create({ data: { propertyId, name: 'Cash Expense Clearing', type: 'EXTERNAL', balance: 0, isActive: true } });
}

async function settleEmployeeReimbursement(id: string, transferReference: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ExpenseClaim" WHERE id = ${id}::uuid FOR UPDATE`;
    const claim = await tx.expenseClaim.findUnique({ where: { id }, select: { id: true, propertyId: true, status: true, autoPaymentStatus: true, paymentReference: true, approvedBy: true, claimNumber: true, category: true, amount: true, description: true, property: { select: { organizationId: true } } } });
    if (!claim || claim.paymentReference !== transferReference) throw new Error('Reimbursement transfer reference does not match the claim');
    if (claim.status === 'REIMBURSED') return claim;
    if (claim.status !== 'APPROVED_FOR_PAYMENT' || claim.autoPaymentStatus !== 'PROCESSING') throw new Error('Reimbursement is not awaiting automatic settlement');

    const actorId = claim.approvedBy || await getReimbursementSystemUser(claim.property.organizationId, tx);
    const context: TenantContext = { organizationId: claim.property.organizationId, userId: actorId, role: 'SYSTEM', permissions: [], propertyIds: [claim.propertyId], outletIds: [] };
    await ensureReimbursementCashControls(tx, claim.propertyId);
    const source = await tx.cashAccount.findFirst({ where: { propertyId: claim.propertyId, type: 'BANK_ACCOUNT', isActive: true, isDefault: true } })
      || await tx.cashAccount.findFirst({ where: { propertyId: claim.propertyId, type: 'BANK_ACCOUNT', isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!source) {
      await tx.expenseClaim.update({ where: { id }, data: { autoPaymentStatus: 'MANUAL_REQUIRED' } });
      throw new Error('No active property bank account is available for reimbursement settlement');
    }
    if (!source.glAccountId) throw new Error(`Payment account ${source.name} is not mapped to a GL account.`);
    const category = await tx.expenseCategory.findFirst({ where: { propertyId: claim.propertyId, isActive: true, OR: [{ name: claim.category }, { code: claim.category }] } });
    if (!category) throw new Error(`Configure an expense category for ${claim.category} before payment.`);
    const expenseAccount = await tx.chartOfAccount.findFirst({ where: { propertyId: claim.propertyId, code: category.debitAccount, type: 'EXPENSE', isActive: true } });
    if (!expenseAccount) throw new Error(`Expense category ${category.name} is mapped to missing GL account ${category.debitAccount}.`);
    const clearing = await ensureReimbursementClearingAccount(tx, claim.propertyId);
    const amount = Number(claim.amount);
    if (Number(source.balance) < amount) throw new Error(`Insufficient balance in ${source.name}.`);
    await tx.cashAccount.update({ where: { id: source.id }, data: { balance: { decrement: amount } } });
    await tx.cashAccount.update({ where: { id: clearing.id }, data: { balance: { increment: amount } } });
    const journal = await GeneralLedgerService.postJournal(context, { propertyId: claim.propertyId, entryDate: new Date(), description: `Employee reimbursement: ${claim.claimNumber}`, reference: claim.claimNumber, sourceModule: 'AUTO_EXPENSE', lines: [
      { accountId: expenseAccount.id, debit: amount, credit: 0, description: claim.description, sourceType: 'CASH_EXPENSE', sourceId: claim.id },
      { accountId: source.glAccountId, debit: 0, credit: amount, description: 'BANK_TRANSFER employee reimbursement', sourceType: 'CASH_EXPENSE', sourceId: claim.id },
    ] }, tx);
    await tx.posCashMovement.create({ data: { propertyId: claim.propertyId, deviceId: 'web-employee-reimbursements', userId: actorId, amount, type: 'CASH_TRANSFER_OUT', sourceAccountId: source.id, destinationAccountId: clearing.id, reasonCode: 'EMPLOYEE_REIMBURSEMENT', receiptReference: claim.claimNumber, operationId: `employee-reimbursement-${claim.id}` } });
    return tx.expenseClaim.update({ where: { id }, data: { status: 'REIMBURSED', autoPaymentStatus: 'SUCCESSFUL', paidBy: actorId, paidAt: new Date(), paymentMethod: 'BANK_TRANSFER', paymentReference: transferReference, paymentAccountId: source.id, accountingJournalEntryId: journal.id } });
  });
}

async function settlePayrollPeriodIfComplete(payrollPeriodId: string) {
  const [period, payouts] = await Promise.all([
    prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId }, select: { id: true, status: true } }),
    prisma.payrollPayout.findMany({ where: { payrollPeriodId }, select: { status: true } }),
  ]);
  if (!period || period.status !== 'PROCESSING' || !payouts.length) return;
  if (payouts.every((payout) => payout.status === 'SUCCESSFUL')) {
    const settledAt = new Date();
    await prisma.$transaction([
      prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { paymentStatus: 'SETTLED', paymentDate: settledAt, status: 'PAID' } }),
      prisma.payslip.updateMany({ where: { payrollPeriodId }, data: { status: 'PAID' } }),
      prisma.referralCommission.updateMany({ where: { payslip: { payrollPeriodId }, payslipId: { not: null }, status: 'APPROVED' }, data: { status: 'PAID', paidAt: settledAt } }),
    ]);
  } else if (payouts.some((payout) => payout.status === 'FAILED')) {
    await prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { paymentStatus: 'PARTIAL' } });
  }
}

function isFlutterwaveRefundEvent(event: any): boolean {
  const data = event?.data || {};
  const eventName = String(event?.event || event?.type || '').toLowerCase();
  const status = String(data.status || '').toLowerCase();
  return eventName.includes('refund') || data.amount_refunded != null || data.AmountRefunded != null
    || (data.flw_ref && status && !['successful', 'success'].includes(status) && !data.tx_ref && !data.reference);
}

async function handleFlutterwaveRefundWebhook(req: NextRequest, rawBody: string, event: any) {
  const data = event?.data || {};
  const candidates = [data.flw_ref, data.FlwRef, data.id, data.refund_id].filter((value) => value != null).map(String);
  if (!candidates.length) return new NextResponse('OK', { status: 200 });

  // The refund ID is stored when the refund is initiated. It lets us resolve
  // the property account before checking the customer-specific webhook secret.
  const refund = await prisma.refund.findFirst({
    where: { providerRefundId: { in: candidates } },
    select: { providerRefundId: true, propertyId: true },
  });
  if (!refund?.providerRefundId) return new NextResponse('OK', { status: 200 });

  const account = await getBookingPaymentAccount(refund.propertyId, 'BOOKING_ENGINE');
  if (!account || account.provider !== 'FLUTTERWAVE') return new NextResponse('OK', { status: 200 });
  let secret: string;
  try {
    secret = account.webhookSecret ?? resolveSecretRef(account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH');
  } catch {
    return new NextResponse('Webhook secret is not configured', { status: 503 });
  }
  let providerSecret: string;
  try {
    providerSecret = account.secret ?? resolveSecretRef(account.secretRef, 'FLW_SECRET_KEY');
  } catch {
    return new NextResponse('Payment provider is not configured', { status: 503 });
  }
  const signature = req.headers.get('flutterwave-signature')?.trim() || '';
  const legacySignature = req.headers.get('verif-hash')?.trim() || '';
  if (!validFlutterwaveSignature(rawBody, [signature, legacySignature], [secret])) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  await reconcileFlutterwaveRefund({
    providerRefundId: refund.providerRefundId,
    status: String(data.status || data.refund_status || ''),
    source: 'WEBHOOK',
    payload: event,
  });
  return new NextResponse('OK', { status: 200 });
}
