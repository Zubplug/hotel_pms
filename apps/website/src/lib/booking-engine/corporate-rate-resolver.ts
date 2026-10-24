import type { Prisma, PrismaClient } from '@hotel-pms/db';

type DbClient = Prisma.TransactionClient | PrismaClient | any;

export type CorporateRateResolutionInput = Readonly<{
  propertyId: string;
  roomTypeId: string;
  sourceRatePlanId?: string | null;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  roomCount?: number;
  currency?: string;
  now?: Date;
}>;

export type CorporateRateRuleLike = Readonly<{
  id: string;
  propertyId: string;
  roomTypeId: string;
  sourceRatePlanId?: string | null;
  rateMethod: string;
  amount?: unknown;
  discountPercent?: unknown;
  currency: string;
  priority: number;
  minAdults: number;
  maxAdults?: number | null;
  minChildren: number;
  maxChildren?: number | null;
  minOccupancy: number;
  maxOccupancy?: number | null;
  minStay: number;
  maxStay?: number | null;
  minLeadTimeHours: number;
  maxAdvanceDays?: number | null;
  minRooms?: number;
  maxRooms?: number | null;
  pricingFactors?: unknown;
  weekdays: number[];
  blackoutDates: Date[];
}>;

export class CorporateRateResolutionError extends Error {
  constructor(
    readonly code: 'CORPORATE_CONTRACT_UNAVAILABLE' | 'CORPORATE_RATE_UNAVAILABLE' | 'CORPORATE_RATE_AMBIGUOUS' | 'CORPORATE_RATE_SCOPE_DENIED',
    message: string,
  ) {
    super(message);
    this.name = 'CorporateRateResolutionError';
  }
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function nightCount(checkIn: Date, checkOut: Date): number {
  return Math.round((Date.UTC(checkOut.getUTCFullYear(), checkOut.getUTCMonth(), checkOut.getUTCDate()) - Date.UTC(checkIn.getUTCFullYear(), checkIn.getUTCMonth(), checkIn.getUTCDate())) / 86_400_000);
}

function sameDate(left: Date, right: Date): boolean {
  return dateOnly(left) === dateOnly(right);
}

function ruleSignature(rule: CorporateRateRuleLike): string {
  return JSON.stringify({
    rateMethod: rule.rateMethod,
    amount: String(rule.amount ?? ''),
    discountPercent: String(rule.discountPercent ?? ''),
    currency: rule.currency.toUpperCase(),
    minRooms: rule.minRooms ?? 1,
    maxRooms: rule.maxRooms ?? null,
    pricingFactors: rule.pricingFactors ?? null,
  });
}

export function isCorporateRateRuleEligible(rule: CorporateRateRuleLike, input: CorporateRateResolutionInput): boolean {
  if (rule.propertyId !== input.propertyId || rule.roomTypeId !== input.roomTypeId) return false;
  if (input.currency && rule.currency.toUpperCase() !== input.currency.toUpperCase()) return false;

  const nights = nightCount(input.checkIn, input.checkOut);
  const occupancy = input.adults + input.children;
  const rooms = input.roomCount ?? 1;
  if (rooms < (rule.minRooms ?? 1) || (rule.maxRooms != null && rooms > rule.maxRooms)) return false;
  if (input.adults < rule.minAdults || (rule.maxAdults != null && input.adults > rule.maxAdults)) return false;
  if (input.children < rule.minChildren || (rule.maxChildren != null && input.children > rule.maxChildren)) return false;
  if (occupancy < rule.minOccupancy || (rule.maxOccupancy != null && occupancy > rule.maxOccupancy)) return false;
  if (nights < rule.minStay || (rule.maxStay != null && nights > rule.maxStay)) return false;

  const now = input.now ?? new Date();
  const leadTimeHours = (input.checkIn.getTime() - now.getTime()) / 3_600_000;
  if (leadTimeHours < rule.minLeadTimeHours) return false;
  const advanceDays = (input.checkIn.getTime() - now.getTime()) / 86_400_000;
  if (rule.maxAdvanceDays != null && advanceDays > rule.maxAdvanceDays) return false;

  if (rule.weekdays.length > 0) {
    for (let cursor = new Date(input.checkIn); cursor < input.checkOut; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (!rule.weekdays.includes(cursor.getUTCDay())) return false;
    }
  }
  if (rule.blackoutDates.some((blackout) => {
    for (let cursor = new Date(input.checkIn); cursor < input.checkOut; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (sameDate(cursor, blackout)) return true;
    }
    return false;
  })) return false;

  return true;
}

export function selectCorporateRateRule(rules: CorporateRateRuleLike[], input: CorporateRateResolutionInput): CorporateRateRuleLike {
  const eligible = rules.filter((rule) => isCorporateRateRuleEligible(rule, input));
  if (eligible.length === 0) {
    throw new CorporateRateResolutionError('CORPORATE_RATE_UNAVAILABLE', 'No approved corporate rate matches the requested stay');
  }

  const highestPriority = Math.max(...eligible.map((rule) => rule.priority));
  const selected = eligible.filter((rule) => rule.priority === highestPriority);
  const signatures = new Set(selected.map(ruleSignature));
  if (signatures.size > 1) {
    throw new CorporateRateResolutionError('CORPORATE_RATE_AMBIGUOUS', 'Multiple approved corporate rates with the same priority conflict');
  }

  return [...selected].sort((left, right) => left.id.localeCompare(right.id))[0];
}

export async function resolveApprovedCorporateRate(
  db: DbClient,
  principal: { organizationId: string; corporateAccountId?: string; corporateApplicationId?: string },
  input: CorporateRateResolutionInput,
) {
  if (!principal.corporateAccountId && !principal.corporateApplicationId) {
    throw new CorporateRateResolutionError('CORPORATE_RATE_SCOPE_DENIED', 'A corporate account or booking application is required');
  }
  const identityWhere = principal.corporateAccountId
    ? { corporateAccountId: principal.corporateAccountId }
    : { corporateBookingApplicationId: principal.corporateApplicationId };

  const contracts = await db.corporateContract.findMany({
    where: {
      organizationId: principal.organizationId,
      ...identityWhere,
      status: 'ACTIVE',
      effectiveFrom: { lte: input.checkIn },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.checkOut } }],
      properties: {
        some: {
          propertyId: input.propertyId,
          status: 'ACTIVE',
          effectiveFrom: { lte: input.checkIn },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.checkOut } }],
        },
      },
    },
    include: {
      versions: {
        where: {
          status: 'ACTIVE',
          effectiveFrom: { lte: input.checkIn },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.checkOut } }],
        },
        orderBy: { version: 'desc' },
        include: { rules: { where: { propertyId: input.propertyId, roomTypeId: input.roomTypeId } } },
      },
    },
  });

  const candidates = contracts.flatMap((contract: any) => contract.versions.map((version: any) => ({ contract, version })));
  if (candidates.length === 0) throw new CorporateRateResolutionError('CORPORATE_CONTRACT_UNAVAILABLE', 'No approved corporate contract is active for this property and stay');

  const matches: Array<{ contract: any; version: any; rule: CorporateRateRuleLike }> = candidates.flatMap(({ contract, version }: { contract: any; version: any }) => version.rules.map((rule: CorporateRateRuleLike) => ({ contract, version, rule })));
  const selected = selectCorporateRateRule(matches.map((item: { rule: CorporateRateRuleLike }) => item.rule), input);
  const resolved = matches.find((item: { rule: CorporateRateRuleLike }) => item.rule.id === selected.id);
  if (!resolved) throw new CorporateRateResolutionError('CORPORATE_RATE_UNAVAILABLE', 'The approved corporate rate could not be resolved');

  return {
    contractId: resolved.contract.id as string,
    contractVersionId: resolved.version.id as string,
    contractVersion: resolved.version.version as number,
    paymentMode: String(resolved.contract.paymentMode || '').toUpperCase(),
    rule: resolved.rule,
  };
}
