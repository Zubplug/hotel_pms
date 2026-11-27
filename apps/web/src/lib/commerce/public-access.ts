import { requireEntitlement } from '@/lib/auth/entitlement';
import prisma from '@hotel-pms/db';

const ACTIVE_PLAN_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const;
const PLAN_RANK: Record<string, number> = {
  ESSENTIAL: 1,
  STARTER: 1,
  PROFESSIONAL: 2,
  BUSINESS: 3,
  ENTERPRISE: 4,
  ENTERPRISE_PLUS: 5,
};

const FOOD_COMMERCE_PRODUCTS = ['ADDON_FOOD_COMMERCE', 'ADDON_FOOD_STANDALONE'] as const;

/**
 * Food Commerce is sold as two packages. The standalone package includes the
 * same operational capabilities, so feature code must not special-case the
 * parent package after entitlement has been granted.
 */
export async function requireFoodCommerceEntitlement(
  organizationId: string,
  propertyId?: string | null,
): Promise<void> {
  let lastError: unknown;

  for (const productCode of FOOD_COMMERCE_PRODUCTS) {
    try {
      await requireEntitlement(organizationId, productCode, propertyId);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Food Commerce entitlement is required');
}

/**
 * Food Commerce is an F&B manager capability, so the add-on must be backed by
 * an operational Professional-or-higher plan for the staff member's property.
 * An empty subscription scope is the existing billing convention for all
 * properties in the organisation.
 */
export async function hasFoodCommercePlanAccess(
  organizationId: string,
  propertyId?: string | null,
): Promise<boolean> {
  if (!propertyId) return false;

  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: { in: [...ACTIVE_PLAN_STATUSES] },
      planId: { not: null },
      OR: [
        { status: 'TRIALING', trialEndsAt: { gt: now } },
        { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { gt: now } },
      ],
    },
    select: {
      scopePropertyIds: true,
      plan: { select: { code: true } },
    },
  });

  return subscriptions.some((subscription) => {
    const scope = subscription.scopePropertyIds;
    const appliesToProperty = scope.length === 0 || scope.includes(propertyId);
    const planRank = PLAN_RANK[String(subscription.plan?.code ?? '').toUpperCase()] ?? 0;
    return appliesToProperty && planRank >= PLAN_RANK.PROFESSIONAL;
  });
}

/**
 * Public storefronts still need the organisation's Commerce entitlement.
 * Return a boolean so public routes do not leak subscription details.
 */
export async function hasPublicCommerceAccess(
  organizationId: string,
  propertyId?: string | null,
): Promise<boolean> {
  try {
    await requireFoodCommerceEntitlement(organizationId, propertyId);
    return true;
  } catch {
    return false;
  }
}
