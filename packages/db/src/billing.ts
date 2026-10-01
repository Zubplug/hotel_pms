export const ACTIVE_BILLING_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const;

type EntitlementReader = {
  entitlement: {
    findFirst(args: { where: Record<string, unknown>; orderBy: Array<Record<string, string>> }): Promise<{
      status: string;
      expiresAt: Date | null;
      startsAt: Date;
      quantity: number | null;
    } | null>;
  };
};

export async function hasEntitlement(
  db: EntitlementReader,
  input: { organizationId: string; productCode: string; propertyId?: string | null; now?: Date },
): Promise<boolean> {
  const now = input.now ?? new Date();
  const propertyScope = input.propertyId
    ? { OR: [{ propertyId: input.propertyId }, { propertyId: null }] }
    : { propertyId: null };
  const entitlement = await db.entitlement.findFirst({
    where: {
      organizationId: input.organizationId,
      productCode: input.productCode,
      status: 'ACTIVE',
      AND: [
        propertyScope,
        { startsAt: { lte: now } },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    orderBy: [{ propertyId: 'desc' }, { expiresAt: 'desc' }],
  });
  return Boolean(entitlement);
}

export async function requireEntitlementCapacity(
  db: EntitlementReader,
  input: { organizationId: string; productCode: string; propertyId?: string | null; requestedQuantity?: number; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();
  const propertyScope = input.propertyId
    ? { OR: [{ propertyId: input.propertyId }, { propertyId: null }] }
    : { propertyId: null };
  const entitlement = await db.entitlement.findFirst({
    where: {
      organizationId: input.organizationId,
      productCode: input.productCode,
      status: 'ACTIVE',
      AND: [
        propertyScope,
        { startsAt: { lte: now } },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    orderBy: [{ propertyId: 'desc' }, { expiresAt: 'desc' }],
  });
  if (!entitlement) throw new Error(`Payment Required: active entitlement ${input.productCode} was not found`);
  const requested = input.requestedQuantity ?? 1;
  if (entitlement.quantity !== null && requested > entitlement.quantity) {
    throw new Error(`Usage limit exceeded for ${input.productCode}: ${requested} requested, ${entitlement.quantity} allowed`);
  }
}

export async function requireEntitlement(
  db: EntitlementReader,
  input: { organizationId: string; productCode: string; propertyId?: string | null; now?: Date },
): Promise<void> {
  if (!(await hasEntitlement(db, input))) {
    const scope = input.propertyId ? ` for property ${input.propertyId}` : '';
    throw new Error(`Payment Required: active entitlement ${input.productCode}${scope} was not found`);
  }
}

export function subscriptionScope(propertyIds: readonly string[] | null | undefined): string[] {
  return Array.from(new Set((propertyIds ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id))));
}

export type BillingScope = { organizationId: string; propertyIds: string[] };

export function billingPriceIds(priceId: unknown, priceIds: unknown): string[] {
  return Array.from(new Set([
    ...(Array.isArray(priceIds) ? priceIds : []),
    ...(typeof priceId === 'string' ? [priceId] : []),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

export function billingMetadata(input: { organizationId: string; planId?: string | null; propertyIds: readonly string[]; productCodes: readonly string[]; priceIds?: readonly string[] }) {
  return {
    organizationId: input.organizationId,
    planId: input.planId ?? '',
    propertyIds: input.propertyIds.join(','),
    productCodes: input.productCodes.join(','),
    priceIds: (input.priceIds ?? []).join(','),
  };
}

export async function validateCheckoutSelection(
  db: PrismaClient,
  input: { organizationId: string; priceIds: string[]; planId?: string | null; propertyIds?: string[] },
) {
  const requestedPriceIds = Array.from(new Set(input.priceIds.filter(Boolean)));
  if (!requestedPriceIds.length) throw new Error('At least one billing price is required');
  const prices = await db.billingPrice.findMany({ where: { id: { in: requestedPriceIds } }, include: { product: true } });
  if (prices.length !== requestedPriceIds.length || prices.some((price) => !price.product.active)) throw new Error('Invalid or inactive billing price');
  const intervals = new Set(prices.map((price) => price.interval));
  if (intervals.size > 1) throw new Error('Monthly and annual billing prices cannot be mixed');
  const plan = input.planId ? await db.billingPlan.findUnique({ where: { id: input.planId }, include: { items: true } }) : null;
  if (input.planId && !plan) throw new Error('Invalid billing plan');
  if (plan) {
    const selectedProductIds = new Set(prices.map((price) => price.productId));
    const missingRequired = plan.items.filter((item) => item.required && !selectedProductIds.has(item.productId));
    if (missingRequired.length) throw new Error('Selected prices do not include every required plan product');
  }
  const propertyIds = subscriptionScope(input.propertyIds ?? []);
  if (propertyIds.length) {
    const validProperties = await db.property.count({ where: { organizationId: input.organizationId, id: { in: propertyIds }, isActive: true } });
    if (validProperties !== propertyIds.length) throw new Error('One or more selected properties are invalid');
  }
  return { prices, plan, propertyIds };
}

export async function requirePlanLimit(
  db: PrismaClient,
  input: { organizationId: string; limit: 'maxProperties' | 'maxRooms' | 'maxUsers' | 'maxOutlets' | 'maxIntegrations'; currentQuantity: number; requestedQuantity?: number },
): Promise<void> {
  const subscriptions = await db.subscription.findMany({
    where: { organizationId: input.organizationId, status: { in: [...ACTIVE_BILLING_STATUSES] } },
    include: { plan: { select: { metadata: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  const limit = subscriptions.reduce<number | null>((best, subscription) => {
    const metadata = subscription.plan?.metadata;
    const value = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)[input.limit]
      : undefined;
    if (value === null) return null;
    if (value === undefined) return best;
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) return best;
    return best === null ? numeric : Math.max(best, numeric);
  }, 0);
  if (limit === null) return;
  if (!subscriptions.length || limit === 0) throw new Error(`Active subscription does not include ${input.limit}`);
  const requested = input.requestedQuantity ?? 1;
  if (input.currentQuantity + requested > limit) throw new Error(`${input.limit} limit exceeded: ${input.currentQuantity + requested} requested, ${limit} allowed`);
}
import type { PrismaClient } from '@prisma/client';
