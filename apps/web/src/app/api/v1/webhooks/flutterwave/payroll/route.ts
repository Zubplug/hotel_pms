import { NextResponse } from 'next/server';
import prisma, { getFlutterwaveTransfer, verifyFlutterwaveLegacyWebhook, verifyFlutterwaveWebhook, decrypt } from '@hotel-pms/db';
import { FLUTTERWAVE_PAYROLL_SLUG, settlePeriodIfComplete } from '@/lib/services/flutterwave-payroll-service';

export async function POST(req: Request) {
  const rawBody = await req.text();
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid payload' }, { status: 400 }); }
  const data = payload?.data ?? payload;
  const reference = String(data?.reference ?? data?.tx_ref ?? '');
  if (!reference) return NextResponse.json({ received: true });
  const payout = await prisma.payrollPayout.findUnique({ where: { providerReference: reference } });
  if (!payout) return NextResponse.json({ received: true });
  const integration = await prisma.installedIntegration.findFirst({ where: { organizationId: payout.organizationId, propertyId: payout.propertyId, status: 'ACTIVE', definition: { slug: FLUTTERWAVE_PAYROLL_SLUG } } });
  if (!integration?.credentialsRef) return NextResponse.json({ error: 'Integration unavailable' }, { status: 503 });
  const credentials = JSON.parse(decrypt(JSON.parse(integration.credentialsRef))) as { secretKey: string; webhookSecretHash: string };
  const signature = req.headers.get('flutterwave-signature');
  const legacy = req.headers.get('verif-hash');
  if (!verifyFlutterwaveWebhook(rawBody, signature, credentials.webhookSecretHash) && !verifyFlutterwaveLegacyWebhook(legacy, credentials.webhookSecretHash)) return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  const transferId = String(data?.id ?? data?.transfer_id ?? payout.providerTransferId ?? '');
  if (!transferId) return NextResponse.json({ received: true });
  const transfer = await getFlutterwaveTransfer(credentials.secretKey, transferId);
  const status = ['SUCCESSFUL', 'COMPLETED'].includes(transfer.status) ? 'SUCCESSFUL' : ['FAILED', 'CANCELLED'].includes(transfer.status) ? 'FAILED' : 'PROCESSING';
  await prisma.payrollPayout.update({ where: { id: payout.id }, data: { providerTransferId: transferId, providerStatus: transfer.status, status, completedAt: status === 'SUCCESSFUL' || status === 'FAILED' ? new Date() : undefined, rawResponse: { id: transfer.id, reference: transfer.reference, status: transfer.status, amount: transfer.amount, currency: transfer.currency } } });
  await settlePeriodIfComplete(payout.payrollPeriodId);
  return NextResponse.json({ received: true });
}
