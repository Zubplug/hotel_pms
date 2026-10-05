// POST /api/public/booking/[slug]/payment/webhook
// Paystack webhook handler for booking engine payments.
// Verifies signature, looks up the BookingPaymentTransaction,
// and on success creates the native Payment + FolioItem in the folio pipeline.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { getOrCreateBookingSystemActor } from '@/lib/booking-engine/system-actor';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { sendPaymentReceiptEmail } from '@/lib/email/booking-emails';
import { getPaystackBookingAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { postBookingAdvanceDeposit } from '@/lib/booking-engine/financial-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  // 1. Read raw body for signature verification
  const rawBody = await req.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  // 3. Acknowledge immediately — Paystack expects a 200 within 30s
  // All heavy lifting happens inside the response handler below.

  if (event.event !== 'charge.success') {
    // Not a payment success — acknowledge and ignore
    return new NextResponse('OK', { status: 200 });
  }

  const providerRef: string = event.data?.reference;
  if (!providerRef) return new NextResponse('OK', { status: 200 });

  // 4. Look up the BookingPaymentTransaction
  const bpt = await prisma.bookingPaymentTransaction.findFirst({
    where: { providerRef },
  });

  if (!bpt) {
    // Unknown reference — not ours, or already processed
    return new NextResponse('OK', { status: 200 });
  }

  const account = await getPaystackBookingAccount(bpt.propertyId);
  let providerSecret: string;
  let webhookSecret: string;
  try {
    providerSecret = resolveSecretRef(account?.secretRef, 'PAYSTACK_SECRET_KEY');
    webhookSecret = resolveSecretRef(account?.webhookSecretRef || account?.secretRef, 'PAYSTACK_SECRET_KEY');
  } catch {
    return new NextResponse('Payment provider is not configured', { status: 503 });
  }

  // Verify Paystack HMAC-SHA512 signature after resolving the property account.
  const signature = req.headers.get('x-paystack-signature') ?? '';
  const expected = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
  const validSignature = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!validSignature) return new NextResponse('Forbidden', { status: 403 });

  // 5. Idempotency guard — already processed
  if (bpt.webhookVerified || bpt.status === 'SUCCESS') {
    return new NextResponse('OK', { status: 200 });
  }

  // 6. Verify with Paystack (double-verify pattern — do not trust webhook payload alone)
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
      // Mark as failed
      await prisma.bookingPaymentTransaction.update({
        where: { id: bpt.id },
        data: { status: 'FAILED', webhookVerified: true, webhookPayload: event },
      });
      return new NextResponse('OK', { status: 200 });
    }
    verifiedAmount = verifyData.data.amount / 100; // Convert from kobo
    verifiedCurrency = verifyData.data.currency;
    providerTxId = String(verifyData.data.id);
    if (Math.abs(verifiedAmount - Number(bpt.amount)) > 0.01 || verifiedCurrency.toUpperCase() !== bpt.currency.toUpperCase()) {
      await prisma.bookingPaymentTransaction.update({
        where: { id: bpt.id },
        data: { status: 'FAILED', webhookVerified: true, webhookPayload: event, metadata: { reason: 'AMOUNT_OR_CURRENCY_MISMATCH', verifiedAmount, verifiedCurrency } as any },
      });
      return new NextResponse('OK', { status: 200 });
    }
  } catch (err) {
    console.error('[Booking Webhook] Paystack verify failed:', err);
    return new NextResponse('OK', { status: 200 });
  }

  // 7. Post the payment to the native Folio pipeline
  try {
    await prisma.$transaction(async (tx) => {
      // Find the reservation + folio
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

      // Confirm the reservation
      await (tx as any).reservation.update({
        where: { id: reservation.id },
        data: { status: 'CONFIRMED' },
      });

      // Mark the BookingPaymentTransaction as SUCCESS
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

      // Audit log
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
            source: 'BOOKING_ENGINE',
          },
          ipAddress: '0.0.0.0',
          userAgent: 'Paystack-Webhook',
          requestId: crypto.randomUUID(),
        },
      });
    });

    const paidReservation = await prisma.reservation.findUnique({
      where: { id: bpt.reservationId! },
      select: { confirmationNumber: true, currency: true, property: { select: { name: true } }, primaryGuest: { select: { email: true } } },
    });
    if (paidReservation?.primaryGuest.email) {
      sendPaymentReceiptEmail({ to: paidReservation.primaryGuest.email, propertyName: paidReservation.property.name, confirmationNumber: paidReservation.confirmationNumber, amount: verifiedAmount, currency: verifiedCurrency }).catch((e) => console.error('[Booking Webhook] receipt email failed', e));
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('[Booking Webhook] Failed to post payment:', err);
    // Mark as failed so it can be retried / investigated
    await prisma.bookingPaymentTransaction.update({
      where: { id: bpt.id },
      data: {
        status: 'FAILED',
        webhookPayload: event,
        metadata: { error: err.message } as any,
      },
    }).catch(() => null);

    // Still return 200 to Paystack — we'll handle it offline
    return new NextResponse('OK', { status: 200 });
  }
}
