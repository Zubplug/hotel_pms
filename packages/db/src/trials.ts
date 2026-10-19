import { Prisma, PrismaClient } from '@prisma/client';

export const TRIAL_DURATION_HOURS = 168;
export const DEFAULT_TRIAL_PLAN_CODE = 'ESSENTIAL';
export const TRIALING_SUBSCRIPTION_STATUS = 'TRIALING';
export const EXPIRED_SUBSCRIPTION_STATUS = 'EXPIRED';

type Db = PrismaClient | Prisma.TransactionClient;

export class TrialAlreadyUsedError extends Error {
  constructor() {
    super('This organization has already used its lifetime trial');
    this.name = 'TrialAlreadyUsedError';
  }
}

export class TrialPlanNotFoundError extends Error {
  constructor(planCode: string) {
    super(`Trial plan ${planCode} was not found or is inactive`);
    this.name = 'TrialPlanNotFoundError';
  }
}

export class TrialIdempotencyConflictError extends Error {
  constructor() {
    super('This idempotency key was already used for a different trial plan');
    this.name = 'TrialIdempotencyConflictError';
  }
}

export function trialEndsAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DURATION_HOURS * 60 * 60 * 1000);
}

export function subscriptionAccessEndsAt(subscription: {
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
}): Date {
  return subscription.status === TRIALING_SUBSCRIPTION_STATUS && subscription.trialEndsAt
    ? subscription.trialEndsAt
    : subscription.currentPeriodEnd;
}

export function hasOperationalSubscription(
  subscription: { status: string; trialEndsAt: Date | null; currentPeriodEnd: Date } | null,
  now = new Date(),
): boolean {
  if (!subscription || !['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status)) return false;
  return subscriptionAccessEndsAt(subscription) > now;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (error instanceof Prisma.PrismaClientKnownRequestError || (typeof error === 'object' && error !== null))
    && (error as { code?: string }).code === 'P2002';
}

function metadataMatchesRequest(metadata: unknown, key: string, planCode: string): 'MATCH' | 'CONFLICT' | 'NONE' {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'NONE';
  const values = metadata as Record<string, unknown>;
  if (values.idempotencyKey !== key) return 'NONE';
  return values.planCode === planCode ? 'MATCH' : 'CONFLICT';
}

/**
 * Creates the internal trial subscription and its permanent eligibility record.
 * The unique TrialHistory.organizationId constraint is deliberately relied on
 * as the final concurrency guard; callers should map TrialAlreadyUsedError to
 * a conflict response rather than retrying the transaction blindly.
 */
export async function activateTrial(
  db: PrismaClient,
  input: {
    organizationId: string;
    planCode?: string;
    now?: Date;
    idempotencyKey?: string;
    source?: string;
  },
) {
  const now = input.now ?? new Date();
  const planCode = (input.planCode ?? DEFAULT_TRIAL_PLAN_CODE).trim().toUpperCase();
  const idempotencyKey = input.idempotencyKey?.trim() || null;
  const source = input.source ?? 'SELF_SERVE';

  try {
    return await db.$transaction(async (tx) => {
      const existingHistory = await tx.trialHistory.findUnique({
        where: { organizationId: input.organizationId },
        include: { subscription: true },
      });
      if (existingHistory) {
        if (idempotencyKey) {
          const requestMatch = metadataMatchesRequest(existingHistory.metadata, idempotencyKey, planCode);
          if (requestMatch === 'MATCH') return existingHistory.subscription;
          if (requestMatch === 'CONFLICT') throw new TrialIdempotencyConflictError();
        }
        throw new TrialAlreadyUsedError();
      }

      const existingSubscription = await tx.subscription.findFirst({
        where: { organizationId: input.organizationId, status: { notIn: ['CANCELED', 'EXPIRED'] } },
        select: { id: true },
      });
      if (existingSubscription) throw new TrialAlreadyUsedError();

      const plan = await tx.billingPlan.findUnique({
        where: { code: planCode },
        include: { items: { include: { product: { include: { prices: true } } } } },
      });
      if (!plan || !plan.active) throw new TrialPlanNotFoundError(planCode);

      const end = trialEndsAt(now);
      const subscription = await tx.subscription.create({
        data: {
          organizationId: input.organizationId,
          planId: plan.id,
          status: TRIALING_SUBSCRIPTION_STATUS,
          currentPeriodStart: now,
          currentPeriodEnd: end,
          trialEndsAt: end,
          cancelAtPeriodEnd: false,
          scopePropertyIds: [],
          items: {
            create: plan.items
              .map((item) => item.product.prices.find((price) => price.interval === 'month'))
              .filter((price): price is NonNullable<typeof price> => Boolean(price))
              .map((price) => ({ priceId: price.id, quantity: 1 })),
          },
        },
      });

      await tx.trialHistory.create({
        data: {
          organizationId: input.organizationId,
          subscriptionId: subscription.id,
          planCode,
          status: 'STARTED',
          startedAt: now,
          source,
          metadata: (idempotencyKey ? { idempotencyKey, planCode } : undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      return subscription;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof TrialAlreadyUsedError || error instanceof TrialPlanNotFoundError) throw error;
    if (isUniqueConstraintError(error)) throw new TrialAlreadyUsedError();
    throw error;
  }
}

/** Marks an unexpired trial as expired. Returns false when another process has
 * already transitioned it or when it has not reached its deadline. */
export async function expireTrial(db: PrismaClient, input: { subscriptionId: string; now?: Date }) {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const claimed = await tx.subscription.updateMany({
      where: {
        id: input.subscriptionId,
        status: TRIALING_SUBSCRIPTION_STATUS,
        trialEndsAt: { lte: now },
      },
      data: { status: EXPIRED_SUBSCRIPTION_STATUS, canceledAt: now, cancelAtPeriodEnd: false },
    });
    if (claimed.count !== 1) return false;

    await tx.trialHistory.updateMany({
      where: { subscriptionId: input.subscriptionId, status: 'STARTED' },
      data: { status: 'EXPIRED', endedAt: now },
    });
    return true;
  });
}

/** Records successful paid conversion without assuming provider-specific
 * subscription identifiers or entitlement details. The payment webhook owns
 * the paid subscription transaction; this only closes the trial history. */
export async function markTrialConverted(db: Db, input: { subscriptionId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const result = await db.trialHistory.updateMany({
    where: { subscriptionId: input.subscriptionId, status: 'STARTED' },
    data: { status: 'CONVERTED', endedAt: now },
  });
  return result.count === 1;
}
