import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { getBookingPaymentAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { reconcileFlutterwaveRefund } from '@/lib/booking-engine/flutterwave-refund-reconciliation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization');
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return new NextResponse('Unauthorized', { status: 401 });

  const refunds = await prisma.refund.findMany({
    where: {
      status: 'PROCESSING',
      providerRefundId: { not: null },
      OR: [
        { payment: { provider: { in: ['FLUTTERWAVE', 'PAYSTACK'] } } },
        { bookingPaymentTransaction: { provider: { in: ['FLUTTERWAVE', 'PAYSTACK'] } } },
      ],
    },
    select: { id: true, propertyId: true, providerRefundId: true, payment: { select: { provider: true } }, bookingPaymentTransaction: { select: { provider: true } } },
    orderBy: { updatedAt: 'asc' },
    take: 100,
  });
  const results: Array<{ id: string; status: string }> = [];

  for (const refund of refunds) {
    try {
      const account = await getBookingPaymentAccount(refund.propertyId);
      if (!account || account.provider !== 'FLUTTERWAVE' || !refund.providerRefundId) continue;
      const secret = account.secret ?? resolveSecretRef(account.secretRef, 'FLW_SECRET_KEY');
      const provider = refund.payment?.provider === 'PAYSTACK' || refund.bookingPaymentTransaction?.provider === 'PAYSTACK'
        ? new PaystackProvider(secret)
        : new FlutterwaveProvider(secret, account.webhookSecret ?? undefined);
      const providerRefund = await provider.fetchRefund(refund.providerRefundId);
      if (!providerRefund) continue;
      const reconciled = await reconcileFlutterwaveRefund({
        providerRefundId: refund.providerRefundId,
        status: providerRefund.status,
        source: 'RECONCILIATION',
        payload: providerRefund,
      });
      results.push({ id: refund.id, status: reconciled.status });
    } catch (error) {
      console.error(`[Flutterwave refund reconciliation] ${refund.id}`, error);
    }
  }

  return NextResponse.json({ checked: refunds.length, updated: results.length, results });
}
