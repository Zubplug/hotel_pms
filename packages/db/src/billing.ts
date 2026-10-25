import type { Prisma, PrismaClient } from '@prisma/client';

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
  subscription?: {
    findMany(args: { where: Record<string, unknown>; select?: Record<string, boolean> }): Promise<Array<{ id: string; status: string; trialEndsAt: Date | null; currentPeriodEnd: Date }>>;
  };
};

export function effectiveSubscriptionDeadline(subscription: {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
}): Date {
  return subscription.status === 'TRIALING' && subscription.trialEndsAt
    ? subscription.trialEndsAt
    : subscription.currentPeriodEnd;
}

export async function getOperationalSubscription(
  db: any,
  organizationId: string,
  now = new Date(),
) {
  const subscriptions = await db.subscription.findMany({
    where: {
      organizationId,
      status: { in: [...ACTIVE_BILLING_STATUSES] },
      planId: { not: null },
      OR: [
        { status: 'TRIALING', trialEndsAt: { gt: now } },
        { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { gt: now } },
      ],
    },
    orderBy: { currentPeriodEnd: 'desc' },
  });
  return subscriptions
    .filter((subscription: any) => subscriptionIsOperational(subscription, now))
    .sort((a: any, b: any) => effectiveSubscriptionDeadline(b).getTime() - effectiveSubscriptionDeadline(a).getTime())[0] ?? null;
}

function subscriptionIsOperational(subscription: {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
}, now: Date): boolean {
  return ACTIVE_BILLING_STATUSES.includes(subscription.status as typeof ACTIVE_BILLING_STATUSES[number])
    && effectiveSubscriptionDeadline(subscription) > now;
}

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
  if (!entitlement || entitlement.startsAt > now || (entitlement.expiresAt !== null && entitlement.expiresAt <= now)) return false;
  if (!db.subscription) return true;
  const subscriptions = await db.subscription.findMany({
    where: {
      organizationId: input.organizationId,
      status: { in: [...ACTIVE_BILLING_STATUSES] },
      OR: [
        { status: 'TRIALING', trialEndsAt: { gt: now } },
        { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { gt: now } },
      ],
    },
    select: { id: true, status: true, trialEndsAt: true, currentPeriodEnd: true },
  });
  return subscriptions.some((subscription) => subscriptionIsOperational(subscription, now)
    && (entitlement.expiresAt === null || entitlement.expiresAt <= effectiveSubscriptionDeadline(subscription)));
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
  if (db.subscription) {
    const subscriptions = await db.subscription.findMany({
      where: {
        organizationId: input.organizationId,
        status: { in: [...ACTIVE_BILLING_STATUSES] },
        OR: [
          { status: 'TRIALING', trialEndsAt: { gt: now } },
          { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { gt: now } },
        ],
      },
      select: { id: true, status: true, trialEndsAt: true, currentPeriodEnd: true },
    });
    const validSubscription = subscriptions.some((subscription) => subscriptionIsOperational(subscription, now)
      && (entitlement.expiresAt === null || entitlement.expiresAt <= effectiveSubscriptionDeadline(subscription)));
    if (!validSubscription) throw new Error(`Payment Required: active subscription for ${input.productCode} was not found`);
  }
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

export function billingMetadata(input: { organizationId: string; planId?: string | null; propertyIds: readonly string[]; productCodes: readonly string[]; priceIds?: readonly string[]; customDomainRequestId?: string | null; customWebsiteRequestId?: string | null; upgradeCredit?: number | null; upgradePeriodEnd?: string | null; discountAmount?: number | null; discountPercentages?: readonly number[] }) {
  return {
    organizationId: input.organizationId,
    planId: input.planId ?? '',
    propertyIds: input.propertyIds.join(','),
    productCodes: input.productCodes.join(','),
    priceIds: (input.priceIds ?? []).join(','),
    propertyCount: String(input.propertyIds.length),
    billingDescription: input.productCodes.length === 1 && input.productCodes[0] === 'ADDON_BEDS24'
      ? `Beds24 Channel Integration x ${input.propertyIds.length} propert${input.propertyIds.length === 1 ? 'y' : 'ies'}`
      : input.productCodes.join(', '),
    customDomainRequestId: input.customDomainRequestId ?? '',
    customWebsiteRequestId: input.customWebsiteRequestId ?? '',
    upgradeCredit: input.upgradeCredit == null ? '' : String(input.upgradeCredit),
    upgradePeriodEnd: input.upgradePeriodEnd ?? '',
    discountAmount: input.discountAmount == null ? '' : String(input.discountAmount),
    discountPercentages: (input.discountPercentages ?? []).join(','),
  };
}

export function billingTotal(prices: Array<{ amount: number; product: { metadata: unknown } }>, propertyIds: readonly string[]) {
  return prices.reduce((total, price) => {
    const metadata = price.product.metadata;
    const unit = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).unit
      : undefined;
    return total + price.amount * (unit === 'PROPERTY' ? Math.max(propertyIds.length, 1) : 1);
  }, 0);
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
  const propertyScopedAddOns = prices.filter((price) => {
    const metadata = price.product.metadata;
    return metadata && typeof metadata === 'object' && !Array.isArray(metadata) && (metadata as Record<string, unknown>).unit === 'PROPERTY';
  });
  if (propertyScopedAddOns.length && !propertyIds.length) throw new Error('Select at least one property for this add-on');
  const requiredProducts = prices.flatMap((price) => {
    const metadata = price.product.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
    const values = metadata as Record<string, unknown>;
    return Array.isArray(values.requiresProducts)
      ? values.requiresProducts.filter((code): code is string => typeof code === 'string' && code.length > 0)
      : [];
  });
  for (const productCode of new Set(requiredProducts)) {
    const scopes = propertyIds.length ? propertyIds : [null];
    for (const propertyId of scopes) {
      if (!(await hasEntitlement(db, { organizationId: input.organizationId, productCode, propertyId }))) {
        throw new Error(`An active ${productCode} entitlement is required before purchasing this add-on`);
      }
    }
  }
  if (propertyScopedAddOns.length) {
    const activeEntitlements = await db.entitlement.findMany({
      where: {
        organizationId: input.organizationId,
        productCode: { in: propertyScopedAddOns.map((price) => price.product.code) },
        status: 'ACTIVE',
        AND: [
          { OR: [{ propertyId: { in: propertyIds } }, { propertyId: null }] },
          { startsAt: { lte: new Date() } },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        ],
      },
      select: { productCode: true, propertyId: true },
    });
    if (activeEntitlements.length) {
      const alreadyActive = new Set(activeEntitlements.map((item) => item.propertyId));
      throw new Error(`Beds24 is already active for ${alreadyActive.size} selected propert${alreadyActive.size === 1 ? 'y' : 'ies'}`);
    }
  }
  return { prices, plan, propertyIds };
}

export async function getEffectiveLimit(
  db: PrismaClient,
  input: { organizationId: string; limit: 'maxProperties' | 'maxRooms' | 'maxUsers' | 'maxOutlets' | 'maxIntegrations' | 'maxTerminals' },
): Promise<number | null> {
  const now = new Date();
  const subscriptions = (await db.subscription.findMany({
    where: { organizationId: input.organizationId, status: { in: [...ACTIVE_BILLING_STATUSES] } },
    include: { plan: { select: { metadata: true } } },
    orderBy: { updatedAt: 'desc' },
  })).filter((subscription) => subscriptionIsOperational(subscription, now));
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

type BillingTx = Prisma.TransactionClient;

/** Rebuilds derived entitlements from authoritative, non-expired subscriptions. */
export async function reconcileOrganizationEntitlements(
  tx: BillingTx,
  organizationId: string,
  now = new Date(),
) {
  const graceCutoff = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const subscriptions = await tx.subscription.findMany({
    where: {
      organizationId,
      OR: [
        { status: 'TRIALING', trialEndsAt: { gt: now } },
        { status: 'ACTIVE', currentPeriodEnd: { gt: now } },
        { status: 'PAST_DUE', currentPeriodEnd: { gt: now }, OR: [{ pastDueSince: null }, { pastDueSince: { gt: graceCutoff } }] },
      ],
    },
    include: {
      items: { include: { price: { include: { product: true } } } },
      plan: { include: { items: { include: { product: true } } } },
    },
  });
  const active = new Map<string, { productCode: string; propertyId: string | null; expiresAt: Date; startsAt: Date; quantity: number | null }>();
  for (const subscription of subscriptions) {
    const expiresAt = effectiveSubscriptionDeadline(subscription);
    const quantities = new Map<string, number | null>(subscription.items.map((item) => [item.price.product.code, item.quantity] as const));
    for (const item of subscription.plan?.items ?? []) quantities.set(item.product.code, item.includedQty ?? null);
    for (const propertyId of (subscription.scopePropertyIds.length ? subscription.scopePropertyIds : [null])) {
      for (const [productCode, quantity] of quantities) {
        const scopeKey = `${organizationId}:${propertyId ?? '*'}:${productCode}`;
        const current = active.get(scopeKey);
        if (!current || current.expiresAt < expiresAt) active.set(scopeKey, { productCode, propertyId, expiresAt, startsAt: subscription.currentPeriodStart, quantity });
      }
    }
  }
  const existing = await tx.entitlement.findMany({ where: { organizationId } });
  for (const [scopeKey, entitlement] of active) {
    await tx.entitlement.upsert({
      where: { scopeKey },
      create: { organizationId, propertyId: entitlement.propertyId, productCode: entitlement.productCode, scopeKey, status: 'ACTIVE', quantity: entitlement.quantity, startsAt: entitlement.startsAt, expiresAt: entitlement.expiresAt, metadata: { source: 'billing-reconciliation' } },
      update: { status: 'ACTIVE', quantity: entitlement.quantity, startsAt: entitlement.startsAt, expiresAt: entitlement.expiresAt, suspendedAt: null, suspensionReason: null, metadata: { source: 'billing-reconciliation' } },
    });
  }
  for (const entitlement of existing) {
    if (!active.has(entitlement.scopeKey)) {
      await tx.entitlement.update({ where: { id: entitlement.id }, data: { status: 'SUSPENDED', suspendedAt: entitlement.suspendedAt ?? now, suspensionReason: 'No active subscription' } });
    }
  }
  return { subscriptions: subscriptions.length, entitlements: active.size };
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
