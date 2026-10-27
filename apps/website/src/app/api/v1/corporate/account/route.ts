import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { checkCorporateRateLimit } from '@/lib/corporate-api-auth';
import { corporateError, corporatePrincipalForProperty, prisma, requireCorporateApi, withRequestId } from '@/lib/corporate-api-routes';

export async function GET(req: NextRequest) {
  const auth = await requireCorporateApi(req, 'account:read');
  if (auth instanceof Response) return auth;
  const propertyId = new URL(req.url).searchParams.get('propertyId');
  if (!propertyId) return withRequestId(errorResponse('BAD_REQUEST', 'propertyId is required', 400), auth.requestId);
  if (!(await checkCorporateRateLimit(auth.principal, 'account'))) return withRequestId(errorResponse('TOO_MANY_REQUESTS', 'Too many requests', 429), auth.requestId);
  try {
    const principal = await corporatePrincipalForProperty(auth.principal, propertyId, 'account:read');
    const account = await prisma.corporateAccount.findFirst({
      where: { id: principal.corporateAccountId, organizationId: auth.principal.organizationId, propertyId, isActive: true },
      select: {
        id: true, name: true, code: true, contactPerson: true, contactEmail: true, contactPhone: true,
        creditLimit: true, depositPolicy: true, propertyId: true, ratePlanId: true,
        cityLedgerAccount: { select: { id: true, name: true, currency: true, balance: true, status: true } },
        corporateContracts: { where: { status: { in: ['APPROVED', 'ACTIVE'] } }, select: { id: true, reference: true, name: true, status: true, defaultCurrency: true, effectiveFrom: true, effectiveTo: true, negotiationEnabled: true, depositMinimumPercent: true, fallbackPolicy: true, properties: { where: { status: 'ACTIVE' }, select: { propertyId: true, effectiveFrom: true, effectiveTo: true } }, versions: { where: { status: { in: ['APPROVED', 'ACTIVE'] } }, orderBy: { version: 'desc' }, take: 1, select: { id: true, version: true, status: true, effectiveFrom: true, effectiveTo: true, termsSnapshot: true, rules: { orderBy: { priority: 'asc' }, select: { id: true, roomTypeId: true, roomType: { select: { name: true } }, rateMethod: true, amount: true, discountPercent: true, currency: true, minStay: true, maxStay: true, minRooms: true, maxRooms: true, inclusions: true, pricingFactors: true } } } } }, orderBy: { effectiveFrom: 'desc' } },
      },
    });
    if (!account) return withRequestId(errorResponse('NOT_FOUND', 'Corporate account not found', 404), auth.requestId);
    const paymentEntries = account.cityLedgerAccount
      ? await prisma.cityLedgerEntry.findMany({
        where: { accountId: account.cityLedgerAccount.id, type: 'PAYMENT', status: { not: 'REVERSED' } },
        select: { amount: true, allocations: { select: { amount: true } } },
      })
      : [];
    const unappliedAdvanceCredit = paymentEntries.reduce((sum, payment) => {
      const allocated = payment.allocations.reduce((total, allocation) => total + Number(allocation.amount || 0), 0);
      return sum + Math.max(0, Number(payment.amount || 0) - allocated);
    }, 0);
    const advanceCredit = account.cityLedgerAccount
      ? Math.max(0, -Number(account.cityLedgerAccount.balance || 0), unappliedAdvanceCredit)
      : 0;
    const accountWithCredit = {
      ...account,
      cityLedgerAccount: account.cityLedgerAccount
        ? { ...account.cityLedgerAccount, advanceCredit }
        : null,
    };
    const today = new Date();
    const defaultContract = await prisma.corporateContract.findFirst({
      where: {
        organizationId: auth.principal.organizationId,
        isPropertyDefault: true,
        defaultPropertyId: propertyId,
        status: 'ACTIVE',
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        reference: true,
        name: true,
        defaultCurrency: true,
        effectiveFrom: true,
        effectiveTo: true,
        versions: {
          where: { status: 'ACTIVE', effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] },
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            version: true,
            rules: {
              orderBy: { priority: 'asc' },
              select: { id: true, roomTypeId: true, roomType: { select: { name: true, code: true } }, sourceRatePlanId: true, rateMethod: true, amount: true, discountPercent: true, currency: true, minStay: true, maxStay: true, minRooms: true, maxRooms: true, pricingFactors: true },
            },
          },
        },
      },
    });
    const defaultRules = defaultContract?.versions[0]?.rules || [];
    const sourceRatePlanIds = Array.from(new Set(defaultRules.map((rule) => rule.sourceRatePlanId).filter((id): id is string => Boolean(id))));
    const roomTypeIds = Array.from(new Set(defaultRules.map((rule) => rule.roomTypeId)));
    const todayDayOfWeek = today.getUTCDay();
    const baseRates = sourceRatePlanIds.length
      ? await prisma.rate.findMany({
        where: {
          propertyId,
          ratePlanId: { in: sourceRatePlanIds },
          roomTypeId: { in: roomTypeIds },
          effectiveFrom: { lte: today },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
          dayOfWeek: { has: todayDayOfWeek },
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { ratePlanId: true, roomTypeId: true, amount: true, currency: true },
      })
      : [];
    const baseRateByRule = new Map<string, { amount: number; currency: string }>();
    for (const rate of baseRates) {
      const key = `${rate.ratePlanId}:${rate.roomTypeId}`;
      if (!baseRateByRule.has(key)) baseRateByRule.set(key, { amount: Number(rate.amount), currency: rate.currency });
    }
    const defaultCorporateRates = defaultRules.map((rule) => {
      const configuredAmount = rule.amount == null ? null : Number(rule.amount);
      const base = rule.sourceRatePlanId ? baseRateByRule.get(`${rule.sourceRatePlanId}:${rule.roomTypeId}`) : undefined;
      const estimatedRate = configuredAmount != null
        ? configuredAmount
        : base
          ? rule.rateMethod === 'PERCENTAGE_DISCOUNT'
            ? Math.max(0, base.amount * (1 - Number(rule.discountPercent || 0) / 100))
            : base.amount
          : null;
      return {
        ...rule,
        amount: configuredAmount,
        discountPercent: rule.discountPercent == null ? null : Number(rule.discountPercent),
        baseRate: base?.amount ?? null,
        baseRateCurrency: base?.currency || rule.currency || defaultContract?.defaultCurrency || 'NGN',
        estimatedRate,
        estimatedCurrency: rule.currency || base?.currency || defaultContract?.defaultCurrency || 'NGN',
        estimateBasis: estimatedRate == null
          ? 'UNAVAILABLE'
          : configuredAmount != null
            ? 'CONFIGURED_CORPORATE_RATE'
            : rule.rateMethod === 'PERCENTAGE_DISCOUNT'
              ? 'PMS_RATE_LESS_CORPORATE_DISCOUNT'
              : 'PMS_RATE_PLAN',
      };
    });
    return withRequestId(successResponse({ account: accountWithCredit, defaultCorporateContract: defaultContract ? { id: defaultContract.id, reference: defaultContract.reference, name: defaultContract.name, defaultCurrency: defaultContract.defaultCurrency, effectiveFrom: defaultContract.effectiveFrom, effectiveTo: defaultContract.effectiveTo, version: defaultContract.versions[0]?.version || null } : null, defaultCorporateRates }), auth.requestId);
  } catch (error) { return corporateError(error, auth.requestId); }
}
