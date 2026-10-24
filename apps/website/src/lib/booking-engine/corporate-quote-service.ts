import crypto from 'node:crypto';
import type { Prisma, PrismaClient } from '@hotel-pms/db';
import { computeCanonicalRoomRateBreakdown, DEFAULT_CANONICAL_ROOM_RATE_BREAKDOWN_CONFIG, type CanonicalRoomRateBreakdown } from '@hotel-pms/db';
import { AuthoritativeAvailabilityService } from './availability-service';
import { ReservationPricingService, type PricingQuote, type PricingSnapshot } from './pricing-service';
import { validateBookingPolicy } from './booking-policy-service';
import { resolveApprovedCorporateRate, CorporateRateResolutionError } from './corporate-rate-resolver';
import { calculateCorporateNightlyRate } from './corporate-rate-calculator';

type TxClient = Prisma.TransactionClient | PrismaClient | any;

export const CORPORATE_QUOTE_TTL_SECONDS = 300;
export const MIN_CORPORATE_QUOTE_TTL_SECONDS = 30;
export const MAX_CORPORATE_QUOTE_TTL_SECONDS = 900;

export type CorporatePrincipal = Readonly<{
  id: string;
  organizationId: string;
  propertyIds: readonly string[];
  corporateAccountId?: string;
  corporateApplicationId?: string;
}>;

export type CorporateQuoteRequest = Readonly<{
  propertyId: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  paymentMode?: string;
  ttlSeconds?: number;
  roomCount?: number;
  roomSelections?: readonly { roomTypeId: string; roomCount: number; checkIn?: string; checkOut?: string }[];
}>;

export type CorporateTaxLine = Readonly<{
  id: string;
  name: string;
  code: string;
  amount: number;
  included: boolean;
}>;

export type CorporateFeeLine = Readonly<{
  id: string;
  name: string;
  code: string;
  amount: number;
  included: boolean;
}>;

export type CorporateQuoteSnapshot = Readonly<{
    version: 1 | 2;
  request: {
    propertyId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    roomCount: number;
    paymentMode: string;
    roomSelections?: readonly { roomTypeId: string; roomCount: number; checkIn?: string; checkOut?: string }[];
  };
  roomSelections?: readonly CorporateQuoteSnapshot[];
  principalId: string;
  corporateAccount: {
    id: string;
    code: string;
    name: string;
  };
  rateDecision: {
    kind: 'CORPORATE_CONTRACT_RULE';
    ratePlanId: string;
    ratePlanCode: string;
    ratePlanName: string;
    priority: number;
    contractId?: string;
    contractVersionId?: string;
    contractVersion?: number;
    ruleId?: string;
  };
  pricing: PricingSnapshot;
  taxes: readonly CorporateTaxLine[];
  fees: readonly CorporateFeeLine[];
  roomChargeBreakdown: {
    grossRate: number;
    netAccommodation: number;
    vatAmount: number;
    serviceChargeAmount: number;
    complimentaryFoodAmount: number;
    complimentaryAllocationName: string;
    foodAllocationSuppressed: boolean;
  };
  nightlyBreakdown: readonly ({ date: string } & Omit<CanonicalRoomRateBreakdown, 'grossRate'> & { grossRate: number })[];
  inclusions: readonly string[];
  cancellationPolicy: Record<string, unknown> | null;
  totals: {
    subtotal: number;
    taxes: number;
    fees: number;
    total: number;
    currency: string;
  };
}>;

export class CorporateQuoteError extends Error {
  constructor(
    readonly code:
      | 'CORPORATE_SCOPE_DENIED'
      | 'CORPORATE_ACCOUNT_UNAVAILABLE'
      | 'CORPORATE_RATE_UNAVAILABLE'
      | 'CORPORATE_RATE_AMBIGUOUS'
      | 'CORPORATE_OCCUPANCY_INVALID'
      | 'QUOTE_EXPIRED'
      | 'QUOTE_NOT_FOUND'
      | 'QUOTE_TAMPERED'
      | 'QUOTE_PRICE_CHANGED',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CorporateQuoteError';
  }
}

type Eligibility = {
  account: { id: string; code: string; name: string };
};

function assertDateRange(input: CorporateQuoteRequest): void {
  if (!Number.isFinite(input.checkIn.getTime()) || !Number.isFinite(input.checkOut.getTime()) || input.checkOut <= input.checkIn) {
    throw new CorporateQuoteError('QUOTE_TAMPERED', 'checkOut must be after checkIn');
  }
  if (!Number.isInteger(input.adults) || input.adults < 1 || !Number.isInteger(input.children) || input.children < 0) {
    throw new CorporateQuoteError('QUOTE_TAMPERED', 'Occupancy is invalid');
  }
  if (input.roomCount != null && (!Number.isInteger(input.roomCount) || input.roomCount < 1 || input.roomCount > 20)) {
    throw new CorporateQuoteError('QUOTE_TAMPERED', 'Room count is invalid');
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function requestFingerprint(input: CorporateQuoteRequest): string {
  const normalized = {
    propertyId: input.propertyId,
    roomTypeId: input.roomTypeId,
    checkIn: isoDate(input.checkIn),
    checkOut: isoDate(input.checkOut),
    adults: input.adults,
    children: input.children,
    roomCount: input.roomCount ?? 1,
    roomSelections: input.roomSelections ?? null,
    paymentMode: (input.paymentMode ?? 'PAY_LATER').toUpperCase(),
  };
  return crypto.createHash('sha256').update(canonical(normalized)).digest('hex');
}

function clampTtl(seconds: number | undefined): number {
  const ttl = seconds ?? CORPORATE_QUOTE_TTL_SECONDS;
  if (!Number.isInteger(ttl) || ttl < MIN_CORPORATE_QUOTE_TTL_SECONDS || ttl > MAX_CORPORATE_QUOTE_TTL_SECONDS) {
    throw new CorporateQuoteError('QUOTE_TAMPERED', `Quote TTL must be between ${MIN_CORPORATE_QUOTE_TTL_SECONDS} and ${MAX_CORPORATE_QUOTE_TTL_SECONDS} seconds`);
  }
  return ttl;
}

function normalizePaymentMode(mode: string | undefined): string {
  const normalized = (mode ?? 'PAY_LATER').toUpperCase();
  if (!['PAY_LATER', 'FULL', 'DEPOSIT', 'PREPAID'].includes(normalized)) throw new CorporateQuoteError('QUOTE_TAMPERED', 'Unsupported corporate payment mode');
  return normalized;
}

async function resolveEligibility(tx: TxClient, principal: CorporatePrincipal, input: CorporateQuoteRequest): Promise<Eligibility> {
  if (!principal.id || principal.organizationId.length === 0 || (!principal.corporateAccountId && !principal.corporateApplicationId) || !principal.propertyIds.includes(input.propertyId)) {
    throw new CorporateQuoteError('CORPORATE_SCOPE_DENIED', 'The corporate principal is not authorized for this property');
  }

  const account = principal.corporateAccountId
    ? await tx.corporateAccount.findFirst({ where: { id: principal.corporateAccountId, organizationId: principal.organizationId, propertyId: input.propertyId, isActive: true }, select: { id: true, code: true, name: true } })
    : null;
  const application = principal.corporateApplicationId
    ? await tx.corporateBookingApplication.findFirst({ where: { id: principal.corporateApplicationId, organizationId: principal.organizationId, propertyId: input.propertyId, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true, companyName: true } })
    : null;
  if (!account && !application) throw new CorporateQuoteError(principal.corporateApplicationId ? 'CORPORATE_ACCOUNT_UNAVAILABLE' : 'CORPORATE_ACCOUNT_UNAVAILABLE', 'The corporate identity is inactive or outside the authorized property scope');
  const roomType = await tx.roomType.findFirst({
    where: { id: input.roomTypeId, propertyId: input.propertyId, isActive: true, deletedAt: null },
    select: { id: true, maxOccupancy: true },
  });
  if (!roomType || input.adults + input.children > roomType.maxOccupancy) {
    throw new CorporateQuoteError('CORPORATE_OCCUPANCY_INVALID', 'Occupancy exceeds the selected room type capacity');
  }

  return {
    account: account
      ? { id: account.id, code: account.code, name: account.name }
      : { id: application!.id, code: `APPLICATION-${application!.id.slice(0, 8).toUpperCase()}`, name: application!.companyName },
  };
}

async function taxLines(tx: TxClient, propertyId: string, subtotal: number): Promise<CorporateTaxLine[]> {
  const configuredTaxes = await tx.tax.findMany({
    where: { propertyId, isActive: true },
    select: { id: true, name: true, code: true, type: true, rate: true, appliesTo: true, isInclusive: true },
    orderBy: { code: 'asc' },
  });

  return configuredTaxes
    .filter((tax: any) => tax.appliesTo.length === 0 || tax.appliesTo.some((target: string) => ['ALL', 'ROOM', 'ROOM_RATE'].includes(target.toUpperCase())))
    .map((tax: any) => {
      const rate = Number(tax.rate);
      const amount = tax.type === 'FLAT'
        ? rate
        : tax.isInclusive
          ? subtotal * rate / (100 + rate)
          : subtotal * rate / 100;
      return {
        id: tax.id,
        name: tax.name,
        code: tax.code,
        amount: round2(amount),
        included: Boolean(tax.isInclusive),
      };
    });
}

async function canonicalBreakdown(
  tx: TxClient,
  propertyId: string,
  pricing: PricingSnapshot,
  roomTypeName: string,
  includeFoodAllocation: boolean,
) {
  const property = await tx.property.findUnique({ where: { id: propertyId }, select: { settings: true } });
  const saved = ((property?.settings as any)?.roomRateBreakdown || {}) as Record<string, any>;
  const config = {
    ...DEFAULT_CANONICAL_ROOM_RATE_BREAKDOWN_CONFIG,
    ...saved,
    roomTypeOverrides: saved.roomTypeOverrides || DEFAULT_CANONICAL_ROOM_RATE_BREAKDOWN_CONFIG.roomTypeOverrides,
  };
  const nightly = pricing.nightlyRates.map((rate) => ({
    date: rate.date.toISOString().slice(0, 10),
    ...computeCanonicalRoomRateBreakdown({
      grossRate: Number(rate.amount),
      config,
      roomTypeName,
      corporateFoodAllocationOverride: includeFoodAllocation,
    }),
  }));
  const sum = (key: keyof CanonicalRoomRateBreakdown) => round2(nightly.reduce((total, item) => total + Number(item[key] || 0), 0));
  return {
    grossRate: sum('grossRate'),
    netAccommodation: sum('netAccommodation'),
    vatAmount: sum('vatAmount'),
    serviceChargeAmount: sum('serviceChargeAmount'),
    complimentaryFoodAmount: sum('complimentaryFoodAmount'),
    complimentaryAllocationName: config.complimentaryAllocationName,
    foodAllocationSuppressed: nightly.every((item) => item.foodAllocationSuppressed),
    nightlyBreakdown: nightly,
  };
}

/** Checks overlapping room lines together, not only one line at a time. */
async function assertCombinedRoomSelectionAvailability(
  tx: TxClient,
  propertyId: string,
  lines: readonly CorporateQuoteSnapshot[],
) {
  const byRoomType = new Map<string, CorporateQuoteSnapshot[]>();
  for (const line of lines) {
    const current = byRoomType.get(line.request.roomTypeId) ?? [];
    current.push(line);
    byRoomType.set(line.request.roomTypeId, current);
  }
  for (const [roomTypeId, roomLines] of byRoomType) {
    const boundaries = [...new Set(roomLines.flatMap((line) => [line.request.checkIn, line.request.checkOut]))].sort();
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const checkIn = new Date(`${boundaries[index]}T00:00:00.000Z`);
      const checkOut = new Date(`${boundaries[index + 1]}T00:00:00.000Z`);
      const demand = roomLines
        .filter((line) => line.request.checkIn < boundaries[index + 1] && line.request.checkOut > boundaries[index])
        .reduce((sum, line) => sum + (line.request.roomCount ?? 1), 0);
      if (demand < 1) continue;
      const availability = await AuthoritativeAvailabilityService.check(tx, { propertyId, roomTypeId, checkIn, checkOut });
      if (availability.availableRooms < demand) {
        throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', 'The selected room lines overlap beyond the available inventory');
      }
    }
  }
}

async function buildQuoteSnapshot(
  tx: TxClient,
  principal: CorporatePrincipal,
  input: CorporateQuoteRequest,
): Promise<CorporateQuoteSnapshot> {
  if (typeof tx.bookingEngineConfig?.findUnique === 'function') {
    const config = await tx.bookingEngineConfig.findUnique({ where: { propertyId: input.propertyId }, select: { minStay: true, maxStay: true, bookingLeadTimeHours: true, maxAdvanceDays: true } });
    if (config) validateBookingPolicy(input, config);
  }
  const paymentMode = normalizePaymentMode(input.paymentMode);
  if (input.roomSelections?.length) {
    const selections = input.roomSelections.filter((selection) => selection.roomCount > 0);
    if (!selections.length || selections.length > 20 || selections.reduce((sum, selection) => sum + selection.roomCount, 0) > 20) throw new CorporateQuoteError('QUOTE_TAMPERED', 'Room selections are invalid');
    const lines = await Promise.all(selections.map((selection) => {
      const checkIn = selection.checkIn ? new Date(`${selection.checkIn}T00:00:00.000Z`) : input.checkIn;
      const checkOut = selection.checkOut ? new Date(`${selection.checkOut}T00:00:00.000Z`) : input.checkOut;
      return buildQuoteSnapshot(tx, principal, { ...input, roomTypeId: selection.roomTypeId, roomCount: selection.roomCount, checkIn, checkOut, roomSelections: undefined, paymentMode });
    }));
    await assertCombinedRoomSelectionAvailability(tx, input.propertyId, lines);
    if (new Set(lines.map((line) => line.totals.currency)).size !== 1) throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', 'Mixed room selections must use one settlement currency');
    const first = lines[0];
    const subtotal = round2(lines.reduce((sum, line) => sum + line.totals.subtotal, 0));
    const taxesTotal = round2(lines.reduce((sum, line) => sum + line.totals.taxes, 0));
    const breakdown = {
      grossRate: round2(lines.reduce((sum, line) => sum + line.roomChargeBreakdown.grossRate, 0)),
      netAccommodation: round2(lines.reduce((sum, line) => sum + line.roomChargeBreakdown.netAccommodation, 0)),
      vatAmount: round2(lines.reduce((sum, line) => sum + line.roomChargeBreakdown.vatAmount, 0)),
      serviceChargeAmount: round2(lines.reduce((sum, line) => sum + line.roomChargeBreakdown.serviceChargeAmount, 0)),
      complimentaryFoodAmount: round2(lines.reduce((sum, line) => sum + line.roomChargeBreakdown.complimentaryFoodAmount, 0)),
      complimentaryAllocationName: first.roomChargeBreakdown.complimentaryAllocationName,
      foodAllocationSuppressed: lines.every((line) => line.roomChargeBreakdown.foodAllocationSuppressed),
    };
    const total = round2(lines.reduce((sum, line) => sum + line.totals.total, 0));
    const deposit = round2(lines.reduce((sum, line) => sum + line.pricing.depositAmount, 0));
    return {
      ...first,
      version: 2 as const,
      request: { ...first.request, roomCount: selections.reduce((sum, selection) => sum + selection.roomCount, 0), roomSelections: selections },
      roomSelections: lines,
      pricing: { ...first.pricing, subtotal, depositAmount: deposit, nightlyRates: lines.flatMap((line) => line.pricing.nightlyRates) },
      taxes: lines.flatMap((line) => line.taxes),
      fees: lines.flatMap((line) => line.fees),
      roomChargeBreakdown: breakdown,
      nightlyBreakdown: lines.flatMap((line) => line.nightlyBreakdown),
      totals: { ...first.totals, subtotal, taxes: taxesTotal, total },
    } as CorporateQuoteSnapshot;
  }
  const eligibility = await resolveEligibility(tx, principal, { ...input, paymentMode });
  let contractRate: Awaited<ReturnType<typeof resolveApprovedCorporateRate>> | null = null;
  try {
    if (typeof tx.corporateContract?.findMany !== 'function') throw new CorporateRateResolutionError('CORPORATE_CONTRACT_UNAVAILABLE', 'Corporate contract storage is not available');
    contractRate = await resolveApprovedCorporateRate(tx, principal, {
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      roomCount: input.roomCount,
      currency: undefined,
    });
  } catch (error) {
    if (error instanceof CorporateRateResolutionError) {
      throw new CorporateQuoteError(error.code === 'CORPORATE_RATE_SCOPE_DENIED' ? 'CORPORATE_SCOPE_DENIED' : error.code === 'CORPORATE_RATE_AMBIGUOUS' ? 'CORPORATE_RATE_AMBIGUOUS' : 'CORPORATE_RATE_UNAVAILABLE', error.message);
    }
    throw error;
  }
  if (!contractRate) throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', 'An approved corporate API rate is required for this property and stay');
  if (contractRate.paymentMode && contractRate.paymentMode !== paymentMode) {
    throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', `This approved corporate contract requires ${contractRate.paymentMode} payment`);
  }

  // A contract rule is the commercial price source. The rate plan below is
  // only the PMS rate-plan reference required by the existing reservation and
  // folio schema; it must be explicitly marked CORPORATE and can never be a
  // STANDARD/public fallback.
  const ratePlanId = contractRate.rule.sourceRatePlanId;
  if (!ratePlanId) throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', 'The approved corporate rule has no explicit CORPORATE PMS rate-plan anchor');
  const ratePlan = await tx.ratePlan.findFirst({
      where: { id: ratePlanId, propertyId: input.propertyId, type: 'CORPORATE', isActive: true, deletedAt: null },
      select: { id: true, code: true, name: true, propertyId: true, includeFoodAllocation: true, cancellationPolicy: true, rates: { select: { currency: true }, take: 1 } },
    });
  if (!ratePlan) throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', 'No active CORPORATE rate plan is configured for the approved API rule');
  await AuthoritativeAvailabilityService.assertAvailable(tx, {
    propertyId: input.propertyId,
    roomTypeId: input.roomTypeId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
  });
  if ((input.roomCount ?? 1) > 1) {
    const availability = await AuthoritativeAvailabilityService.check(tx, {
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    });
    if (availability.availableRooms < (input.roomCount ?? 1)) throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', 'The requested number of rooms is not available for the selected stay');
  }

  const corporateNightlyRate = contractRate.rule.rateMethod === 'FIXED_NIGHTLY' && contractRate.rule.amount != null
    ? calculateCorporateNightlyRate({
      baseNightlyAmount: Number(contractRate.rule.amount),
      nights: Math.max(1, Math.round((input.checkOut.getTime() - input.checkIn.getTime()) / 86_400_000)),
      roomCount: input.roomCount,
      paymentMode,
      factors: contractRate.rule.pricingFactors as any,
    })
    : undefined;
  if (corporateNightlyRate == null) throw new CorporateQuoteError('CORPORATE_RATE_UNAVAILABLE', 'The approved corporate rate method is not supported');
  const pricing = await ReservationPricingService.quote(tx, {
    propertyId: input.propertyId,
    ratePlanId: ratePlan.id,
    roomTypeId: input.roomTypeId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    paymentMode,
    corporateNightlyRate: { amount: corporateNightlyRate, currency: contractRate.rule.currency },
  });
  const roomCount = input.roomCount ?? 1;
  const scaledSubtotal = round2(pricing.subtotal * roomCount);
  const scaledPricing: PricingSnapshot = {
    ...pricing.snapshot,
    subtotal: scaledSubtotal,
    depositAmount: round2(pricing.depositAmount * roomCount),
  };
  const perRoomBreakdown = await canonicalBreakdown(tx, input.propertyId, pricing.snapshot, pricing.snapshot.roomTypeName, Boolean(ratePlan.includeFoodAllocation));
  const breakdown = {
    ...perRoomBreakdown,
    grossRate: round2(perRoomBreakdown.grossRate * roomCount),
    netAccommodation: round2(perRoomBreakdown.netAccommodation * roomCount),
    vatAmount: round2(perRoomBreakdown.vatAmount * roomCount),
    serviceChargeAmount: round2(perRoomBreakdown.serviceChargeAmount * roomCount),
    complimentaryFoodAmount: round2(perRoomBreakdown.complimentaryFoodAmount * roomCount),
  };
  const taxes: CorporateTaxLine[] = breakdown.vatAmount > 0
    ? [{ id: 'ROOM_RATE_VAT', name: 'VAT', code: 'VAT', amount: breakdown.vatAmount, included: true }]
    : [];
  const fees: CorporateFeeLine[] = breakdown.serviceChargeAmount > 0
    ? [{ id: 'ROOM_RATE_SERVICE_CHARGE', name: 'Service charge', code: 'SERVICE_CHARGE', amount: breakdown.serviceChargeAmount, included: true }]
    : [];

  return {
    version: 1,
    request: {
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      checkIn: isoDate(input.checkIn),
      checkOut: isoDate(input.checkOut),
      adults: input.adults,
      children: input.children,
      roomCount,
      paymentMode,
      roomSelections: undefined,
    },
    principalId: principal.id,
    corporateAccount: eligibility.account,
    rateDecision: {
      kind: 'CORPORATE_CONTRACT_RULE',
      ratePlanId: ratePlan.id,
      ratePlanCode: ratePlan.code,
      ratePlanName: ratePlan.name,
      priority: contractRate.rule.priority,
      contractId: contractRate.contractId,
      contractVersionId: contractRate.contractVersionId,
      contractVersion: contractRate.contractVersion,
      ruleId: contractRate.rule.id,
    },
    pricing: scaledPricing,
    taxes,
    fees,
    roomChargeBreakdown: breakdown,
    nightlyBreakdown: breakdown.nightlyBreakdown,
    inclusions: ratePlan.includeFoodAllocation ? ['FOOD_ALLOCATION'] : [],
    cancellationPolicy: ratePlan.cancellationPolicy
      ? JSON.parse(JSON.stringify(ratePlan.cancellationPolicy, decimalReplacer))
      : null,
    totals: {
      subtotal: scaledSubtotal,
      taxes: round2(breakdown.vatAmount),
      fees: round2(breakdown.serviceChargeAmount),
      total: round2(scaledSubtotal),
      currency: pricing.currency,
    },
  };
}

export async function createCorporateQuote(
  tx: TxClient,
  principal: CorporatePrincipal,
  input: CorporateQuoteRequest,
  now = new Date(),
) {
  assertDateRange(input);
  const ttlSeconds = clampTtl(input.ttlSeconds);
  const snapshot = await buildQuoteSnapshot(tx, principal, input);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const quote = await tx.bookingQuote.create({
    data: {
      organizationId: principal.organizationId,
      propertyId: input.propertyId,
      principalId: principal.id,
      corporateAccountId: principal.corporateAccountId,
      corporateBookingApplicationId: principal.corporateApplicationId,
      requestFingerprint: requestFingerprint(input),
      status: 'ACTIVE',
      expiresAt,
      snapshot: JSON.parse(JSON.stringify(snapshot, decimalReplacer)),
    },
  });
  return { id: quote.id, expiresAt, snapshot };
}

/** Builds the same corporate pricing snapshot used by quote creation without persisting a quote. */
export async function previewCorporateQuoteSnapshot(
  tx: TxClient,
  principal: CorporatePrincipal,
  input: CorporateQuoteRequest,
) {
  assertDateRange(input);
  return buildQuoteSnapshot(tx, principal, input);
}

export async function getCorporateQuote(
  tx: TxClient,
  principal: CorporatePrincipal,
  quoteId: string,
  now = new Date(),
) {
  const quote = await tx.bookingQuote.findFirst({
      where: {
      id: quoteId,
      organizationId: principal.organizationId,
      principalId: principal.id,
      corporateAccountId: principal.corporateAccountId,
      corporateBookingApplicationId: principal.corporateApplicationId,
      propertyId: { in: [...principal.propertyIds] },
    },
  });
  if (!quote) throw new CorporateQuoteError('QUOTE_NOT_FOUND', 'Quote not found');
  if (quote.status !== 'ACTIVE') throw new CorporateQuoteError(quote.status === 'EXPIRED' ? 'QUOTE_EXPIRED' : 'QUOTE_TAMPERED', 'Quote is no longer active');
  if (quote.expiresAt <= now) {
    await tx.bookingQuote.updateMany({ where: { id: quote.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
    throw new CorporateQuoteError('QUOTE_EXPIRED', 'Quote has expired; create a new quote');
  }
  return quote;
}

/**
 * Rechecks inventory, eligibility, configured taxes, and the current rate
 * without creating another quote. Expiry is handled separately by
 * `getCorporateQuote`, so callers can distinguish QUOTE_EXPIRED from a live
 * quote whose price changed.
 */
export async function revalidateCorporateQuote(
  tx: TxClient,
  principal: CorporatePrincipal,
  quoteId: string,
  now = new Date(),
) {
  const quote = await getCorporateQuote(tx, principal, quoteId, now);
  const snapshot = quote.snapshot as CorporateQuoteSnapshot;
  const input: CorporateQuoteRequest = {
    propertyId: snapshot.request.propertyId,
    roomTypeId: snapshot.request.roomTypeId,
    checkIn: new Date(`${snapshot.request.checkIn}T00:00:00.000Z`),
    checkOut: new Date(`${snapshot.request.checkOut}T00:00:00.000Z`),
    adults: snapshot.request.adults,
    children: snapshot.request.children,
    roomCount: snapshot.request.roomCount,
    paymentMode: snapshot.request.paymentMode,
    roomSelections: snapshot.request.roomSelections,
  };
  if (requestFingerprint(input) !== quote.requestFingerprint) {
    throw new CorporateQuoteError('QUOTE_TAMPERED', 'Quote request fingerprint does not match its immutable request');
  }
  const current = await buildQuoteSnapshot(tx, principal, input);
  if (priceSnapshotFingerprint(current) !== priceSnapshotFingerprint(snapshot)) {
    throw new CorporateQuoteError('QUOTE_PRICE_CHANGED', 'The quoted rate or policy changed; create a fresh quote', {
      previous: snapshot.totals,
      current: current.totals,
    });
  }
  return { quote, snapshot, current };
}

export function priceSnapshotFingerprint(snapshot: CorporateQuoteSnapshot): string {
  return crypto.createHash('sha256').update(canonical({
    roomSelections: snapshot.roomSelections?.map((line) => ({ request: line.request, rateDecision: line.rateDecision, pricing: line.pricing, taxes: line.taxes, totals: line.totals })),
    rateDecision: snapshot.rateDecision,
    pricing: snapshot.pricing,
    taxes: snapshot.taxes,
    fees: snapshot.fees,
    inclusions: snapshot.inclusions,
    cancellationPolicy: snapshot.cancellationPolicy,
    totals: snapshot.totals,
  })).digest('hex');
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function decimalReplacer(_key: string, value: unknown): unknown {
  return value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber?: unknown }).toNumber === 'function'
    ? Number((value as { toNumber: () => number }).toNumber())
    : value;
}

export { canonical as canonicalizeCorporateQuoteValue };
