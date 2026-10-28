import crypto from 'node:crypto';

export type CorporateEventQuoteInput = {
  organizationId: string;
  propertyId: string;
  principalId: string;
  corporateAccountId: string;
  requestType: 'HALL_ONLY' | 'HALL_AND_EVENT';
  hallId: string;
  startAt: Date;
  endAt: Date;
  expectedGuests: number;
  eventName?: string;
  paymentMode: 'PAY_LATER' | 'DEPOSIT' | 'FULL';
  addOns?: Array<{ equipmentId: string; quantity: number }>;
};

export type CorporateEventAddon = {
  equipmentId: string;
  name: string;
  description: string | null;
  rentalPrice: number;
  currency: string;
  availableQuantity: number;
};

const QUOTE_TTL_SECONDS = 600;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function fingerprint(input: CorporateEventQuoteInput) {
  return crypto.createHash('sha256').update(JSON.stringify({
    propertyId: input.propertyId,
    corporateAccountId: input.corporateAccountId,
    requestType: input.requestType,
    hallId: input.hallId,
    startAt: input.startAt.toISOString(),
    endAt: input.endAt.toISOString(),
    expectedGuests: input.expectedGuests,
    eventName: input.eventName?.trim() || null,
    paymentMode: input.paymentMode,
    addOns: [...(input.addOns || [])].sort((a, b) => a.equipmentId.localeCompare(b.equipmentId)),
  })).digest('hex');
}

function normalizeAddOns(addOns: CorporateEventQuoteInput['addOns']) {
  return [...(addOns || [])]
    .filter((item) => item.quantity > 0)
    .map((item) => ({ equipmentId: item.equipmentId, quantity: Math.floor(item.quantity) }))
    .sort((a, b) => a.equipmentId.localeCompare(b.equipmentId));
}

function validate(input: CorporateEventQuoteInput) {
  if (!['PAY_LATER', 'DEPOSIT', 'FULL'].includes(input.paymentMode)) throw new Error('INVALID_PAYMENT_MODE');
  if (!Number.isInteger(input.expectedGuests) || input.expectedGuests < 1) throw new Error('INVALID_GUEST_COUNT');
  if (!Number.isFinite(input.startAt.getTime()) || !Number.isFinite(input.endAt.getTime()) || input.endAt <= input.startAt || input.startAt <= new Date()) throw new Error('INVALID_DATE_RANGE');
  if (input.requestType === 'HALL_AND_EVENT' && !input.eventName?.trim()) throw new Error('EVENT_NAME_REQUIRED');
  if ((input.addOns || []).some((item) => !item.equipmentId || !Number.isInteger(item.quantity) || item.quantity < 0)) throw new Error('INVALID_ADDON_QUANTITY');
}

export async function getAvailableCorporateEventAddons(db: any, input: { propertyId: string; startAt: Date; endAt: Date }): Promise<CorporateEventAddon[]> {
  const equipment = await db.eventEquipment.findMany({
    where: { propertyId: input.propertyId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, totalStock: true, rentalPrice: true },
  });
  if (!equipment.length) return [];
  const bookings = await db.eventEquipmentBooking.findMany({
    where: {
      equipmentId: { in: equipment.map((item: any) => item.id) },
      eventBooking: { status: 'ACTIVE', event: { status: { not: 'CANCELLED' }, startDate: { lt: input.endAt }, endDate: { gt: input.startAt } } },
    },
    select: { equipmentId: true, quantity: true },
  });
  const used = new Map<string, number>();
  for (const booking of bookings) used.set(booking.equipmentId, (used.get(booking.equipmentId) || 0) + booking.quantity);
  return equipment.map((item: any) => ({ equipmentId: item.id, name: item.name, description: item.description, rentalPrice: round(Number(item.rentalPrice || 0)), currency: 'NGN', availableQuantity: Math.max(0, item.totalStock - (used.get(item.id) || 0)) })).filter((item) => item.availableQuantity > 0);
}

async function activeCorporateTerms(db: any, input: CorporateEventQuoteInput) {
  const contracts = await db.corporateContract.findMany({
    where: {
      organizationId: input.organizationId,
      status: 'ACTIVE',
      AND: [
        { effectiveFrom: { lte: input.startAt } },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.endAt } }] },
        { properties: { some: { propertyId: input.propertyId, status: 'ACTIVE', effectiveFrom: { lte: input.startAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.endAt } }] } } },
        { OR: [{ corporateAccountId: input.corporateAccountId }, { isPropertyDefault: true, defaultPropertyId: input.propertyId }] },
      ],
    },
    orderBy: [{ isPropertyDefault: 'asc' }, { updatedAt: 'desc' }],
    include: {
      versions: {
        where: { status: { in: ['ACTIVE', 'APPROVED'] }, effectiveFrom: { lte: input.startAt }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.endAt } }] },
        orderBy: { version: 'desc' },
        take: 1,
        select: { id: true, version: true, termsSnapshot: true },
      },
    },
  });
  const selected = contracts.find((contract: any) => contract.versions[0]) || null;
  return selected ? { contract: selected, version: selected.versions[0] } : null;
}

function pricingForHall(hall: any, terms: any) {
  const rules = Array.isArray(terms?.hallRules) ? terms.hallRules : [];
  const rule = rules.find((item: any) => item.hallId === hall.id) || rules.find((item: any) => !item.hallId) || null;
  const standardRate = Number(hall.rate || 0);
  let corporateRate = standardRate;
  let discountAmount = 0;
  let discountPercent = 0;
  const effectiveRule = rule || (terms?.hallDiscountPercent != null ? { rateMethod: 'PERCENTAGE_DISCOUNT', discountPercent: Number(terms.hallDiscountPercent), currency: terms.defaultCurrency } : null);
  if (effectiveRule) {
    if (effectiveRule.rateMethod === 'FIXED' && Number.isFinite(Number(effectiveRule.amount))) corporateRate = Number(effectiveRule.amount);
    else if (effectiveRule.rateMethod === 'PERCENTAGE_DISCOUNT') {
      discountPercent = Math.max(0, Math.min(100, Number(effectiveRule.discountPercent || 0)));
      corporateRate = standardRate * (1 - discountPercent / 100);
    } else if (effectiveRule.rateMethod === 'FIXED_DISCOUNT') {
      discountAmount = Math.max(0, Number(effectiveRule.amount || 0));
      corporateRate = standardRate - discountAmount;
    }
  }
  corporateRate = round(Math.max(0, corporateRate));
  discountAmount = round(Math.max(0, standardRate - corporateRate));
  if (!discountPercent && standardRate > 0) discountPercent = round((discountAmount / standardRate) * 100);
  return { standardRate: round(standardRate), corporateRate, discountAmount, discountPercent, rule: effectiveRule, contractId: terms?.contractId || null, contractVersion: terms?.contractVersion || null };
}

export async function getCorporateHallPricing(db: any, input: CorporateEventQuoteInput, hall: any) {
  const selected = await activeCorporateTerms(db, input);
  const pricing = pricingForHall(hall, selected?.version?.termsSnapshot);
  const snapshot = selected?.version?.termsSnapshot as any;
  const negotiationEnabled = Boolean(snapshot?.hallNegotiationEnabled ?? snapshot?.negotiationEnabled ?? selected?.contract?.negotiationEnabled);
  const rule = pricing.rule;
  const durationHours = (input.endAt.getTime() - input.startAt.getTime()) / 3600000;
  const eligible = !rule || ((rule.minGuests == null || input.expectedGuests >= Number(rule.minGuests)) && (rule.maxGuests == null || input.expectedGuests <= Number(rule.maxGuests)) && (rule.minHours == null || durationHours >= Number(rule.minHours)) && (rule.maxHours == null || durationHours <= Number(rule.maxHours)));
  return { ...pricing, negotiationAvailable: negotiationEnabled && eligible, currency: rule?.currency || snapshot?.defaultCurrency || 'NGN' };
}

export async function createCorporateEventQuote(db: any, input: CorporateEventQuoteInput) {
  validate(input);
  const existing = await db.bookingQuote.findFirst({ where: { organizationId: input.organizationId, propertyId: input.propertyId, principalId: input.principalId, requestFingerprint: fingerprint(input), status: 'ACTIVE', expiresAt: { gt: new Date() } } });
  if (existing) return { id: existing.id, expiresAt: existing.expiresAt, snapshot: existing.snapshot, idempotent: true };

  const hall = await db.hall.findFirst({ where: { id: input.hallId, propertyId: input.propertyId, isActive: true }, select: { id: true, name: true, code: true, capacity: true, squareMeters: true, amenities: true, photos: true, rate: true } });
  if (!hall || hall.rate == null || input.expectedGuests > hall.capacity) throw new Error('HALL_UNAVAILABLE');
  const conflicts = await db.eventBooking.findMany({ where: { hallId: hall.id, status: 'ACTIVE', startTime: { lt: input.endAt }, endTime: { gt: input.startAt }, event: { status: { not: 'CANCELLED' } } }, select: { startTime: true, endTime: true, setupBufferMinutes: true, teardownBufferMinutes: true } });
  if (conflicts.some((row: any) => new Date(row.startTime).getTime() - Number(row.setupBufferMinutes || 0) * 60000 < input.endAt.getTime() && new Date(row.endTime).getTime() + Number(row.teardownBufferMinutes || 0) * 60000 > input.startAt.getTime())) throw new Error('HALL_NO_LONGER_AVAILABLE');

  const terms = await activeCorporateTerms(db, input);
  const pricing = await getCorporateHallPricing(db, input, hall);
  const availableAddons = await getAvailableCorporateEventAddons(db, input);
  const selectedAddons = normalizeAddOns(input.addOns);
  const addonMap = new Map(availableAddons.map((item) => [item.equipmentId, item]));
  for (const selected of selectedAddons) {
    const addon = addonMap.get(selected.equipmentId);
    if (!addon || selected.quantity > addon.availableQuantity) throw new Error('ADDON_UNAVAILABLE');
  }
  const addonTotal = round(selectedAddons.reduce((sum, selected) => sum + (addonMap.get(selected.equipmentId)?.rentalPrice || 0) * selected.quantity, 0));
  const total = round(pricing.corporateRate + addonTotal);
  const requiredPayment = input.paymentMode === 'FULL' ? total : input.paymentMode === 'DEPOSIT' ? round(total * 0.5) : 0;
  const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);
  const snapshot = {
    version: 1,
    kind: 'CORPORATE_EVENT_HALL',
    request: { propertyId: input.propertyId, corporateAccountId: input.corporateAccountId, requestType: input.requestType, hallId: input.hallId, startAt: input.startAt.toISOString(), endAt: input.endAt.toISOString(), expectedGuests: input.expectedGuests, eventName: input.eventName?.trim() || null, paymentMode: input.paymentMode },
    hall: { id: hall.id, name: hall.name, code: hall.code, capacity: hall.capacity, photos: hall.photos, amenities: hall.amenities },
    pricing: { standardRate: pricing.standardRate, corporateRate: pricing.corporateRate, addonTotal, subtotal: total, total, discountAmount: pricing.discountAmount, discountPercent: pricing.discountPercent, requiredPayment, currency: pricing.currency, rateSource: pricing.rule ? 'CORPORATE_CONTRACT' : 'STANDARD_HALL_RATE' },
    addons: { available: availableAddons, selected: selectedAddons },
    contract: terms ? { id: terms.contract.id, versionId: terms.version.id, version: terms.version.version } : null,
    negotiation: { available: pricing.negotiationAvailable },
  };
  const quote = await db.bookingQuote.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, principalId: input.principalId, corporateAccountId: input.corporateAccountId, requestFingerprint: fingerprint(input), expiresAt, snapshot } });
  return { id: quote.id, expiresAt, snapshot, idempotent: false };
}

export async function getCorporateEventQuote(db: any, input: { id: string; organizationId: string; propertyId: string; principalId: string; corporateAccountId: string }) {
  const quote = await db.bookingQuote.findFirst({ where: { id: input.id, organizationId: input.organizationId, propertyId: input.propertyId, principalId: input.principalId, corporateAccountId: input.corporateAccountId, status: 'ACTIVE' } });
  if (!quote) throw new Error('QUOTE_NOT_FOUND');
  if (quote.expiresAt <= new Date()) { await db.bookingQuote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' } }); throw new Error('QUOTE_EXPIRED'); }
  return quote;
}
