import { NextResponse } from 'next/server';
import prisma, { getEffectiveLimit } from '@hotel-pms/db';
import { auth } from '@/lib/auth';

const LIMITS = ['maxProperties', 'maxRooms', 'maxUsers', 'maxOutlets', 'maxIntegrations', 'maxTerminals'] as const;

export async function GET() {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [plans, products, subscriptions, entitlements] = await Promise.all([
    prisma.billingPlan.findMany({ where: { active: true }, orderBy: { displayOrder: 'asc' }, include: { items: { include: { product: { select: { code: true, name: true, type: true } } } } } }),
    prisma.billingProduct.findMany({ where: { active: true }, orderBy: [{ type: 'asc' }, { name: 'asc' }], include: { prices: { orderBy: { interval: 'asc' } } } }),
    prisma.subscription.findMany({ where: { organizationId }, orderBy: { updatedAt: 'desc' }, select: { id: true, planId: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, scopePropertyIds: true } }),
    prisma.entitlement.findMany({ where: { organizationId }, orderBy: [{ status: 'asc' }, { productCode: 'asc' }], select: { productCode: true, propertyId: true, status: true, quantity: true, startsAt: true, expiresAt: true } }),
  ]);

  const limits = Object.fromEntries(await Promise.all(LIMITS.map(async (limit) => [limit, await getEffectiveLimit(prisma, { organizationId, limit })])));

  return NextResponse.json({
    catalogVersion: Math.max(1, ...products.map((product) => product.catalogVersion)),
    plans: plans.map((plan) => ({ ...plan, items: plan.items.map((item) => ({ ...item, product: item.product })) })),
    products: products.map((product) => ({ ...product, metadata: product.metadata })),
    subscriptions,
    entitlements,
    limits,
  });
}
