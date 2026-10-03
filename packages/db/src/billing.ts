export const ACTIVE_BILLING_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const;
export const ADDON_ELIGIBLE_SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING'] as const;

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

export function billingMetadata(input: { organizationId: string; planId?: string | null; propertyIds: readonly string[]; productCodes: readonly string[]; priceIds?: readonly string[]; customDomainRequestId?: string | null; customWebsiteRequestId?: string | null }) {
  return {
    organizationId: input.organizationId,
    planId: input.planId ?? '',
    propertyIds: input.propertyIds.join(','),
    productCodes: input.productCodes.join(','),
    priceIds: (input.priceIds ?? []).join(','),
    customDomainRequestId: input.customDomainRequestId ?? '',
    customWebsiteRequestId: input.customWebsiteRequestId ?? '',
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
  if (prices.some((price) => {
    const metadata = price.product.metadata;
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) && (metadata as Record<string, unknown>).sellable === false;
  })) throw new Error('One or more selected catalogue products are not yet available for purchase');
  const intervals = new Set(prices.map((price) => price.interval));
  if (intervals.size > 1) throw new Error('Monthly and annual billing prices cannot be mixed');
  const plan = input.planId ? await db.billingPlan.findUnique({ where: { id: input.planId }, include: { items: { include: { product: { select: { code: true } } } } } }) : null;
  if (input.planId && !plan) throw new Error('Invalid billing plan');
  if (plan) {
    const selectedProductIds = new Set(prices.map((price) => price.productId));
    // Module products are included in the plan and do not have standalone
    // prices. Only billable plan products must be present in checkout.
    const missingRequired = plan.items.filter((item) => item.required && !item.product.code.toUpperCase().startsWith("MODULE_") && !selectedProductIds.has(item.productId));
    if (missingRequired.length) throw new Error('Selected prices do not include every required plan product');
  }
  const isAddOnOnlyCheckout = !plan && prices.every((price) => price.product.type === 'ADDON');
  if (isAddOnOnlyCheckout) {
    const activeBaseSubscription = await db.subscription.findFirst({
      where: {
        organizationId: input.organizationId,
        status: { in: [...ADDON_ELIGIBLE_SUBSCRIPTION_STATUSES] },
        planId: { not: null },
      },
      select: { id: true },
    });
    if (!activeBaseSubscription) {
      throw new Error('An active base-plan subscription is required before purchasing an add-on');
    }
  }
  const propertyIds = subscriptionScope(input.propertyIds ?? []);
  if (propertyIds.length) {
    const validProperties = await db.property.count({ where: { organizationId: input.organizationId, id: { in: propertyIds }, isActive: true } });
    if (validProperties !== propertyIds.length) throw new Error('One or more selected properties are invalid');
  }
  return { prices, plan, propertyIds };
}

export async function getEffectiveLimit(
  db: PrismaClient,
  input: { organizationId: string; limit: 'maxProperties' | 'maxRooms' | 'maxUsers' | 'maxOutlets' | 'maxIntegrations' | 'maxTerminals' },
): Promise<number | null> {
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
  if (limit === null) return null;
  if (!subscriptions.length) return 0;

  const now = new Date();
  const capacityAddOns = await db.entitlement.findMany({
    where: {
      organizationId: input.organizationId,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { product: { select: { metadata: true } } },
  });
  const addOnCapacity = capacityAddOns.reduce((total, entitlement) => {
    const metadata = entitlement.product.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return total;
    const values = metadata as Record<string, unknown>;
    if (values.capacityKey !== input.limit) return total;
    const quantity = entitlement.quantity ?? 0;
    const amount = typeof values.capacityAmount === 'number' ? values.capacityAmount : Number(values.capacityAmount);
    return Number.isFinite(amount) ? total + quantity * amount : total;
  }, 0);
  const effectiveLimit = limit + addOnCapacity;
  return effectiveLimit;
}

export async function requirePlanLimit(
  db: PrismaClient,
  input: { organizationId: string; limit: 'maxProperties' | 'maxRooms' | 'maxUsers' | 'maxOutlets' | 'maxIntegrations' | 'maxTerminals'; currentQuantity: number; requestedQuantity?: number },
): Promise<void> {
  const limit = await getEffectiveLimit(db, input);
  if (limit === null) return;
  if (limit === 0) throw new Error(`Active subscription does not include ${input.limit}`);
  const requested = input.requestedQuantity ?? 1;
  if (input.currentQuantity + requested > limit) throw new Error(`${input.limit} limit exceeded: ${input.currentQuantity + requested} requested, ${limit} allowed`);
}
import type { PrismaClient } from '@prisma/client';
