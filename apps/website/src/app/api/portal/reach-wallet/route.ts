import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import prisma, { createFlutterwaveCheckout } from '@hotel-pms/db';

async function organizationId() {
  const session = await auth();
  return (session?.user as { organizationId?: string } | undefined)?.organizationId ?? null;
}

export async function GET() {
  const orgId = await organizationId();
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [wallet, debts, fees] = await Promise.all([
    prisma.reachWallet.findUnique({ where: { organizationId: orgId }, select: { id: true, balance: true, currency: true, status: true } }),
    prisma.reachPropertyDebt.findMany({ where: { organizationId: orgId }, include: { property: { select: { id: true, name: true, isActive: true, suspendedAt: true, suspensionReason: true } } }, orderBy: { outstandingAmount: 'desc' } }),
    prisma.referralPlatformFee.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, propertyId: true, amount: true, outstandingAmount: true, walletAppliedAmount: true, currency: true, status: true, createdAt: true } }),
  ]);
  return NextResponse.json({ wallet: wallet ? { ...wallet, balance: Number(wallet.balance) } : { balance: 0, currency: 'NGN', status: 'ACTIVE' }, debts: debts.map((d) => ({ ...d, outstandingAmount: Number(d.outstandingAmount), suspensionThreshold: Number(d.suspensionThreshold) })), fees: fees.map((f) => ({ ...f, amount: Number(f.amount), outstandingAmount: Number(f.outstandingAmount), walletAppliedAmount: Number(f.walletAppliedAmount) })) });
}

export async function POST(request: NextRequest) {
  const orgId = await organizationId();
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.FLW_SECRET_KEY) return NextResponse.json({ error: 'Flutterwave wallet funding is not configured' }, { status: 503 });
  const session = await auth();
  const user = session?.user as { email?: string; name?: string } | undefined;
  if (!user?.email) return NextResponse.json({ error: 'A billing email is required' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 100) return NextResponse.json({ error: 'Minimum wallet funding is NGN 100' }, { status: 400 });
  const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, defaultCurrency: true } });
  if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const txRef = `reach-wallet-${orgId}-${randomUUID()}`;
  const wallet = await prisma.reachWallet.upsert({ where: { organizationId: orgId }, create: { organizationId: orgId, currency: organization.defaultCurrency || 'NGN' }, update: {} });
  const transaction = await prisma.reachWalletTransaction.create({ data: { walletId: wallet.id, organizationId: orgId, type: 'FUNDING', status: 'PENDING', amount, currency: wallet.currency, provider: 'FLUTTERWAVE', providerReference: txRef, idempotencyKey: txRef, description: 'Reach wallet funding through Flutterwave' } });
  try {
    const checkout = await createFlutterwaveCheckout({ amount, currency: wallet.currency, txRef, redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://getlodgecore.vercel.app'}/portal/dashboard?reachWalletFunded=true`, customer: { email: user.email, name: user.name || organization.name }, meta: { lodgecore_source: 'reach_wallet', organizationId: orgId, walletTransactionId: transaction.id } });
    return NextResponse.json({ url: checkout.link, transactionId: transaction.id });
  } catch (error) {
    await prisma.reachWalletTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED', metadata: { error: error instanceof Error ? error.message : 'Flutterwave initialization failed' } } });
    return NextResponse.json({ error: 'Unable to initialize Flutterwave funding' }, { status: 502 });
  }
}
