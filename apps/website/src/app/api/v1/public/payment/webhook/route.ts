import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { getOrCreateBookingSystemActor } from '@/lib/booking-engine/system-actor';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { sendPaymentReceiptEmail } from '@/lib/email/booking-emails';
import { sendBookingPaymentFailedEmail } from '@/lib/email/booking-emails';
import { getPaystackBookingAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { postBookingAdvanceDeposit } from '@/lib/booking-engine/financial-service';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  if (event.event !== 'charge.success') {
    return new NextResponse('OK', { status: 200 });
  }

  const providerRef: string = event.data?.reference;
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
    sendBookingPaymentFailedEmail({
      to: failedReservation.primaryGuest.email,
      propertyName: (await prisma.property.findUnique({ where: { id: bpt.propertyId }, select: { name: true } }))?.name ?? 'the property',
      confirmationNumber: failedReservation.confirmationNumber,
      amount,
      currency,
    }).catch((emailError) => console.error('[Booking Webhook] failure email failed', emailError));
  };

  const account = await getPaystackBookingAccount(bpt.propertyId);
  let providerSecret: string;
  let webhookSecret: string;
  try {
    providerSecret = resolveSecretRef(account?.secretRef, 'PAYSTACK_SECRET_KEY');
    webhookSecret = resolveSecretRef(account?.webhookSecretRef || account?.secretRef, 'PAYSTACK_SECRET_KEY');
  } catch {
    return new NextResponse('Payment provider is not configured', { status: 503 });
  }

  const signature = req.headers.get('x-paystack-signature') ?? '';
  const expected = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
  const validSignature = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return new NextResponse('Forbidden', { status: 403 });

  if (bpt.webhookVerified || bpt.status === 'SUCCESS') {
    return new NextResponse('OK', { status: 200 });
  }

  let verifiedAmount: number;
  let verifiedCurrency: string;
  let providerTxId: string;

  try {
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
    if (Math.abs(verifiedAmount - Number(bpt.amount)) > 0.01 || verifiedCurrency.toUpperCase() !== bpt.currency.toUpperCase()) {
      await prisma.bookingPaymentTransaction.update({
        where: { id: bpt.id },
        data: { status: 'FAILED', webhookVerified: true, webhookPayload: event, metadata: { reason: 'AMOUNT_OR_CURRENCY_MISMATCH', verifiedAmount, verifiedCurrency } as any },
      });
      await notifyPaymentFailure(verifiedAmount, verifiedCurrency);
      return new NextResponse('OK', { status: 200 });
    }
  } catch (err) {
    console.error('[Booking Webhook] Paystack verify failed:', err);
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
        providerRef,
        providerTransactionId: providerTxId,
        businessDate,
        systemActorId,
      });

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
            provider: 'PAYSTACK',
            providerRef,
            reservationId: reservation.id,
            source: 'PUBLIC_API',
          },
          ipAddress: '0.0.0.0',
          userAgent: 'Paystack-Webhook',
          requestId: crypto.randomUUID(),
        },
      });
    });

    const paidReservation = await prisma.reservation.findUnique({
      where: { id: bpt.reservationId! },
      select: { confirmationNumber: true, currency: true, property: { select: { name: true } }, primaryGuest: { select: { email: true } }, reservationRooms: { where: { status: 'ACTIVE' }, include: { room: { select: { number: true } } } } },
    });
    if (paidReservation?.primaryGuest.email) {
      sendPaymentReceiptEmail({ to: paidReservation.primaryGuest.email, propertyName: paidReservation.property.name, confirmationNumber: paidReservation.confirmationNumber, amount: verifiedAmount, currency: verifiedCurrency, roomNumber: paidReservation.reservationRooms[0]?.room?.number }).catch((e) => console.error('[Booking Webhook] receipt email failed', e));
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
