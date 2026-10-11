import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { getOrCreateBookingSystemActor } from '@/lib/booking-engine/system-actor';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { sendBookingConfirmedEmail, sendPaymentReceiptEmail } from '@/lib/email/booking-emails';
import { sendBookingPaymentFailedEmail } from '@/lib/email/booking-emails';
import { getBookingPaymentAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { postBookingAdvanceDeposit } from '@/lib/booking-engine/financial-service';
import { reconcileFlutterwaveRefund } from '@/lib/booking-engine/flutterwave-refund-reconciliation';

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

  const account = await getBookingPaymentAccount(bpt.propertyId);
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
      const provider = new FlutterwaveProvider(providerSecret, webhookSecret);
      // Flutterwave currently supports HMAC-SHA256 (`flutterwave-signature`)
      // and the legacy plain secret hash (`verif-hash`). Accept either valid
      // header independently because some dashboard/manual deliveries include
      // both headers.
      return provider.validateWebhookSignature(rawBody, flutterwaveSignature)
        || provider.validateWebhookSignature(rawBody, flutterwaveLegacySignature);
    })()
    : (() => {
      const signature = req.headers.get('x-paystack-signature') ?? '';
      const expected = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
      return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    })();
  if (!validSignature) return new NextResponse('Forbidden', { status: 403 });

  if (bpt.webhookVerified || bpt.status === 'SUCCESS') {
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
  } catch (err) {
    console.error(`[Booking Webhook] ${bpt.provider} verify failed:`, err);
    return new NextResponse('OK', { status: 200 });
  }

  try {
    await prisma.$transaction(async (tx) => {
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
        data: { status: 'CONFIRMED' },
      });

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
      },
    });
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

  const account = await getBookingPaymentAccount(refund.propertyId);
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
  const provider = new FlutterwaveProvider(providerSecret, secret);
  const signature = req.headers.get('flutterwave-signature')?.trim() || '';
  const legacySignature = req.headers.get('verif-hash')?.trim() || '';
  if (!provider.validateWebhookSignature(rawBody, signature) && !provider.validateWebhookSignature(rawBody, legacySignature)) {
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
