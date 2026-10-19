import { NextResponse } from 'next/server';
import prisma, { getFlutterwaveTransfer, verifyFlutterwaveLegacyWebhook, verifyFlutterwaveWebhook } from '@hotel-pms/db';
import { getFlutterwavePayrollIntegration, settlePeriodIfComplete } from '@/lib/services/flutterwave-payroll-service';
import { EmployeeExpenseReimbursementService } from '@/lib/services/employee-expense-reimbursement-service';

export async function POST(req: Request) {
  const rawBody = await req.text();
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }); }
  const data = payload?.data ?? payload;
  const reference = String(data?.reference ?? data?.tx_ref ?? '');
  if (!reference) return NextResponse.json({ received: true });
  const payout = await prisma.payrollPayout.findUnique({ where: { providerReference: reference } });
  const reimbursement = payout ? null : await prisma.expenseClaim.findFirst({ where: { paymentReference: reference, autoPaymentStatus: { in: ['PROCESSING', 'SUCCESSFUL'] } }, select: { id: true, propertyId: true, amount: true, currency: true, paymentReference: true } });
  if (!payout && !reimbursement) return NextResponse.json({ received: true });
  const propertyId = payout?.propertyId || reimbursement!.propertyId;
  const integration = await getFlutterwavePayrollIntegration(payout?.organizationId || (await prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { organizationId: true } })).organizationId, propertyId);
  if (!integration) return NextResponse.json({ error: 'Integration unavailable' }, { status: 503 });
  const credentials = integration.credentials;
  const signature = req.headers.get('flutterwave-signature');
  const legacy = req.headers.get('verif-hash');
  if (!verifyFlutterwaveWebhook(rawBody, signature, credentials.webhookSecretHash) && !verifyFlutterwaveLegacyWebhook(legacy, credentials.webhookSecretHash)) return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  const transferId = String(data?.id ?? data?.transfer_id ?? payout?.providerTransferId ?? '');
  if (!transferId) return NextResponse.json({ received: true });
  const transfer = await getFlutterwaveTransfer(credentials.secretKey, transferId);
  const expectedAmount = Number(payout?.amount ?? reimbursement!.amount);
  const expectedCurrency = payout?.currency ?? reimbursement!.currency;
  if (String(transfer.reference || '') !== reference || Math.abs(Number(transfer.amount) - expectedAmount) > 0.01 || String(transfer.currency).toUpperCase() !== expectedCurrency.toUpperCase()) return NextResponse.json({ error: 'Transfer verification mismatch' }, { status: 409 });
  const status = ['SUCCESSFUL', 'COMPLETED'].includes(transfer.status) ? 'SUCCESSFUL' : ['FAILED', 'CANCELLED'].includes(transfer.status) ? 'FAILED' : 'PROCESSING';
  if (reimbursement) {
    if (status === 'SUCCESSFUL') {
      try {
        await EmployeeExpenseReimbursementService.settleFlutterwaveBankClaim(reimbursement.id, reference);
      } catch (error) {
        console.error('[Flutterwave reimbursement webhook] GL settlement failed', { claimId: reimbursement.id, error });
      }
    } else if (status === 'FAILED') {
      await prisma.expenseClaim.updateMany({ where: { id: reimbursement.id, autoPaymentStatus: 'PROCESSING' }, data: { autoPaymentStatus: 'FAILED' } });
    }
    return NextResponse.json({ received: true });
  }
  if (!payout) return NextResponse.json({ received: true });
  await prisma.payrollPayout.update({ where: { id: payout.id }, data: { providerTransferId: transferId, providerStatus: transfer.status, status, completedAt: status === 'SUCCESSFUL' || status === 'FAILED' ? new Date() : undefined, rawResponse: { id: transfer.id, reference: transfer.reference, status: transfer.status, amount: transfer.amount, currency: transfer.currency } } });
  await settlePeriodIfComplete(payout.payrollPeriodId);
  return NextResponse.json({ received: true });
}
