import prisma from '@hotel-pms/db';
import { hasEntitlement } from '@/lib/auth/entitlement';

export type AmenityDefinition = {
  key: string;
  name: string;
  aliases: string[];
  quantityPerGuest: number;
  expectedCost: number;
  stockItemId?: string;
};

export const DEFAULT_GUEST_AMENITY_PACK: AmenityDefinition[] = [
  // Complimentary water and Bottle Water are separate stock items. Keep the
  // legacy spelling as an alias, but never alias Bottle Water into this pack.
  { key: 'complimentary-water', name: 'Complimentary Water', aliases: ['complimentry water', 'complimentary water', 'complementary water'], quantityPerGuest: 1, expectedCost: 125 },
  { key: 'sachet-milk', name: 'Sachet Milk', aliases: ['sachet milk', 'satchet milk'], quantityPerGuest: 1, expectedCost: 162 },
  { key: 'milo', name: 'Milo', aliases: ['milo'], quantityPerGuest: 1, expectedCost: 175 },
  { key: 'sugar-cube', name: 'Sugar Cube', aliases: ['sugar cube', 'sugar cubes'], quantityPerGuest: 1, expectedCost: 30 },
];

export function normalizeGuestAmenityName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveInventoryUnitCost(stock: any) {
  const baseCost = Number(stock?.costPrice || 0);
  if (baseCost > 0) return baseCost;

  const purchaseUnit = Array.isArray(stock?.stockUnits)
    ? stock.stockUnits.find((unit: any) => unit.isPurchaseUnit && Number(unit.purchaseCost || 0) > 0)
      || stock.stockUnits.find((unit: any) => Number(unit.purchaseCost || 0) > 0)
    : null;
  const purchaseCost = Number(purchaseUnit?.purchaseCost || 0);
  const unitsInBase = Number(purchaseUnit?.unitsInBase || 0);
  return purchaseCost > 0 && unitsInBase > 0 ? purchaseCost / unitsInBase : 0;
}

export function resolveGuestAmenityDefinitions(settings: any): AmenityDefinition[] {
  const configured = settings?.guestAmenities;
  if (configured?.enabled === false) return [];
  if (!Array.isArray(configured?.items) || configured.items.length === 0) {
    return DEFAULT_GUEST_AMENITY_PACK;
  }
  return configured.items.map((item: any, index: number) => ({
    key: String(item.key || item.stockItemId || `guest-amenity-${index}`),
    name: String(item.name || item.key || '').trim(),
    aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
    quantityPerGuest: Math.max(0, Number(item.quantityPerGuest ?? item.quantityPerRoom ?? 1)),
    expectedCost: Math.max(0, Number(item.expectedCost ?? 0)),
    stockItemId: item.stockItemId ? String(item.stockItemId) : undefined,
  })) as AmenityDefinition[];
}

/**
 * Builds the night-audit preflight for complimentary amenities using the same
 * warehouse, item matching, quantity and fallback-cost rules as posting.
 */
export async function getGuestAmenityAuditControl(propertyId: string, businessDate: Date) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true, settings: true, baseCurrency: true },
  });
  if (!property) throw new Error('NOT_FOUND:Property not found');

  // Complimentary stock-backed amenities are a Professional Operations
  // feature. Properties on Starter (or without an active Operations module)
  // continue through the normal complimentary/front-desk flow.
  if (!(await hasEntitlement(property.organizationId, 'MODULE_OPERATIONS', propertyId))) {
    return {
      enabled: false,
      warehouse: null,
      guestCount: 0,
      perGuestCost: 0,
      estimatedCost: 0,
      items: [],
      missingItems: [],
      shortages: [],
      warnings: [],
      zeroCostItems: [],
      blockers: [],
      currency: property.baseCurrency || 'NGN',
    };
  }

  const settings = (property.settings || {}) as any;
  const guestAmenities = settings.guestAmenities || {};
  const definitions = resolveGuestAmenityDefinitions(settings);
  const checkedInReservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: 'CHECKED_IN',
      reservationRooms: { some: { status: 'ACTIVE', checkIn: { lte: businessDate }, checkOut: { gt: businessDate } } },
    },
    select: { id: true, adults: true, children: true },
  });
  const guestCount = checkedInReservations.reduce((total, reservation) =>
    total + Math.max(1, Number(reservation.adults || 0) + Number(reservation.children || 0)), 0);

  if (!definitions.length) {
    return {
      enabled: false,
      warehouse: null,
      guestCount,
      perGuestCost: 0,
      estimatedCost: 0,
      items: [],
      missingItems: [],
      shortages: [],
      warnings: [],
      zeroCostItems: [],
      blockers: [],
    };
  }

  const configuredWarehouseId = String(guestAmenities.warehouseId || guestAmenities.stockWarehouseId || '');
  const warehouse = configuredWarehouseId
    ? await prisma.warehouse.findFirst({
        where: { id: configuredWarehouseId, propertyId, isActive: true },
        select: { id: true, name: true },
      })
    : await prisma.warehouse.findFirst({
        where: {
          propertyId,
          isActive: true,
          OR: [{ name: { contains: 'housekeeping', mode: 'insensitive' } }, { name: { contains: 'laundry', mode: 'insensitive' } }],
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });

  const stockItems = warehouse
    ? await prisma.stockItem.findMany({
        where: { propertyId, warehouseId: warehouse.id, isActive: true },
        select: {
          id: true,
          name: true,
          baseUnit: true,
          costPrice: true,
          quantityOnHand: true,
          stockUnits: { select: { unit: true, unitsInBase: true, purchaseCost: true, isPurchaseUnit: true } },
        },
      })
    : [];

  let perGuestCost = 0;
  const missingItems: string[] = [];
  const shortages: Array<{ name: string; required: number; available: number; unit: string }> = [];
  const zeroCostItems: string[] = [];
  const items = definitions.map((definition) => {
    const stock = stockItems.find((candidate) => definition.stockItemId
      ? candidate.id === definition.stockItemId
      : [definition.name, ...definition.aliases].some((name) => normalizeGuestAmenityName(name) === normalizeGuestAmenityName(candidate.name)));
    const inventoryCost = resolveInventoryUnitCost(stock);
    const unitCost = inventoryCost > 0 ? inventoryCost : definition.expectedCost;
    const required = definition.quantityPerGuest * guestCount;
    const available = Number(stock?.quantityOnHand || 0);
    if (!stock) missingItems.push(definition.name);
    if (stock && inventoryCost <= 0) zeroCostItems.push(definition.name);
    if (stock && available < required) shortages.push({ name: definition.name, required, available, unit: stock.baseUnit });
    perGuestCost += definition.quantityPerGuest * unitCost;
    return {
      name: definition.name,
      stockItemName: stock?.name || null,
      unit: stock?.baseUnit || null,
      quantityPerGuest: definition.quantityPerGuest,
      required,
      available,
      unitCost,
      estimatedCost: definition.quantityPerGuest * unitCost,
      status: !stock ? 'MISSING' : available < required ? 'INSUFFICIENT_STOCK' : inventoryCost <= 0 ? 'REFERENCE_COST' : 'READY',
    };
  });

  const warnings = [
    guestCount > 0 && !warehouse ? 'Configure an active housekeeping/laundry warehouse.' : null,
    ...(guestCount > 0 ? missingItems.map((name) => `${name} is not configured in the selected warehouse.`) : []),
    ...(guestCount > 0 ? shortages.map((item) => `${item.name} requires ${item.required} ${item.unit} but only ${item.available} is available.`) : []),
  ].filter(Boolean) as string[];

  return {
    enabled: true,
    warehouse,
    guestCount,
    perGuestCost,
    estimatedCost: perGuestCost * guestCount,
    items,
    missingItems,
    shortages,
    zeroCostItems,
    // Stock is operational fulfilment, not a financial audit prerequisite.
    blockers: [],
    warnings,
    currency: property.baseCurrency || 'NGN',
  };
}

export type GuestAmenityPostingResult = {
  itemCount: number;
  issuedQuantity: number;
  shortageQuantity: number;
  totalCost: number;
  shortages: Array<{ name: string; required: number; issued: number; shortage: number; unit: string; reason: string }>;
};

/**
 * Issues complimentary amenities on a best-effort basis. Financial Night
 * Audit must not depend on housekeeping stock: every item gets an immutable
 * fulfilment row, while StockTransaction is written only for quantities that
 * were actually issued. The operation key makes retries safe.
 */
export async function postGuestAmenityPackInTransaction(
  tx: any,
  input: {
    propertyId: string;
    nightAuditId: string;
    reservationId: string;
    roomId?: string | null;
    businessDate: Date;
    guestCount: number;
    actorId: string;
  },
) {
  const property = await tx.property.findUnique({
    where: { id: input.propertyId },
    select: { settings: true, baseCurrency: true, supportedCurrencies: true },
  });
  if (!property) throw new Error('Property is unavailable for guest amenity posting.');

  const settings = (property.settings || {}) as any;
  const guestAmenities = settings.guestAmenities || {};
  const definitions = resolveGuestAmenityDefinitions(settings);
  if (!definitions.length) return { itemCount: 0, issuedQuantity: 0, shortageQuantity: 0, totalCost: 0, shortages: [] };

  const configuredWarehouseId = guestAmenities.warehouseId || guestAmenities.stockWarehouseId;
  const targetWarehouse = configuredWarehouseId
    ? await tx.warehouse.findFirst({
        where: { id: String(configuredWarehouseId), propertyId: input.propertyId, isActive: true },
        select: { id: true, name: true },
      })
    : await tx.warehouse.findFirst({
        where: {
          propertyId: input.propertyId,
          isActive: true,
          OR: [{ name: { contains: 'housekeeping', mode: 'insensitive' } }, { name: { contains: 'laundry', mode: 'insensitive' } }],
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
  const candidates = targetWarehouse
    ? await tx.stockItem.findMany({
        where: { propertyId: input.propertyId, warehouseId: targetWarehouse.id, isActive: true },
        include: { warehouse: { select: { id: true, name: true } }, stockUnits: true },
      })
    : [];
  let itemCount = 0;
  let issuedQuantity = 0;
  let shortageQuantity = 0;
  let totalCost = 0;
  const shortages: GuestAmenityPostingResult['shortages'] = [];
  const currency = property.baseCurrency || property.supportedCurrencies?.[0] || 'NGN';

  for (const definition of definitions) {
    if (!definition.name || definition.quantityPerGuest <= 0) continue;
    const configuredId = (definition as any).stockItemId as string | undefined;
    const matches = candidates.filter((item: any) => configuredId
      ? item.id === configuredId
      : [definition.name, ...definition.aliases].some((name) => normalizeGuestAmenityName(name) === normalizeGuestAmenityName(item.name)));
    const required = definition.quantityPerGuest * Math.max(1, input.guestCount);
    const stock = matches[0];
    const operationId = `GUEST_AMENITY_${input.reservationId}_${input.businessDate.toISOString().slice(0, 10)}_${definition.key}`;
    if (await tx.guestAmenityFulfillment.findUnique({ where: { operationId } })) continue;

    const unit = stock?.baseUnit || 'UNIT';
    const available = Number(stock?.quantityOnHand || 0);
    const requestedIssue = Math.min(required, Math.max(0, available));
    let issued = 0;
    let after: any = null;
    let unitCost = definition.expectedCost;
    let reason: string | null = null;

    if (!targetWarehouse) {
      reason = 'No active housekeeping/laundry warehouse is configured.';
    } else if (!stock) {
      reason = `Amenity is not configured in the ${targetWarehouse.name} warehouse.`;
    } else if (requestedIssue > 0) {
      // Atomic conditional decrement prevents negative stock if two audit or
      // fulfilment workers race for the same inventory row.
      const updated = await tx.stockItem.updateMany({
        where: { id: stock.id, isActive: true, quantityOnHand: { gte: requestedIssue } },
        data: { quantityOnHand: { decrement: requestedIssue } },
      });
      if (updated.count === 1) {
        issued = requestedIssue;
        after = await tx.stockItem.findUnique({
          where: { id: stock.id },
          select: {
            quantityOnHand: true,
            costPrice: true,
            stockUnits: { select: { unit: true, unitsInBase: true, purchaseCost: true, isPurchaseUnit: true } },
          },
        });
        const inventoryCost = resolveInventoryUnitCost(after) || resolveInventoryUnitCost(stock);
        unitCost = inventoryCost > 0 ? inventoryCost : definition.expectedCost;
        const value = issued * unitCost;
        await tx.stockTransaction.create({
          data: {
            propertyId: input.propertyId,
            stockItemId: stock.id,
            reservationId: input.reservationId,
            roomId: input.roomId || null,
            source: 'GUEST_AMENITY',
            quantity: -issued,
            unitCost,
            quantityBefore: Number(after?.quantityOnHand || 0) + issued,
            quantityAfter: Number(after?.quantityOnHand || 0),
            totalValue: -value,
            currency,
            warehouseId: stock.warehouseId,
            reference: input.reservationId,
            notes: `Complimentary guest amenity issue for ${input.guestCount} registered guest(s)`,
            operationId: `${operationId}_STOCK`,
            userId: input.actorId,
            businessDate: input.businessDate,
          },
        });
        totalCost += value;
      } else {
        reason = 'Stock changed before the amenity could be issued.';
      }
    } else {
      reason = 'No stock is currently available.';
    }

    const shortage = Math.max(0, required - issued);
    const status = shortage === 0 ? 'FULFILLED' : issued > 0 ? 'PARTIALLY_FULFILLED' : 'PENDING';
    await tx.guestAmenityFulfillment.create({
      data: {
        propertyId: input.propertyId,
        nightAuditId: input.nightAuditId,
        reservationId: input.reservationId,
        roomId: input.roomId || null,
        stockItemId: stock?.id || null,
        warehouseId: stock?.warehouseId || targetWarehouse?.id || null,
        businessDate: input.businessDate,
        amenityKey: definition.key,
        amenityName: definition.name,
        unit,
        guestCount: Math.max(1, input.guestCount),
        requiredQuantity: required,
        issuedQuantity: issued,
        shortageQuantity: shortage,
        stockBefore: available,
        stockAfter: Number(after?.quantityOnHand || available),
        unitCost,
        totalValue: issued * unitCost,
        estimatedShortageValue: shortage * unitCost,
        currency,
        status,
        reason,
        operationId,
      },
    });

    itemCount++;
    issuedQuantity += issued;
    shortageQuantity += shortage;
    if (shortage > 0) shortages.push({ name: definition.name, required, issued, shortage, unit, reason: reason || 'Insufficient stock.' });
  }

  return { itemCount, issuedQuantity, shortageQuantity, totalCost, shortages };
}

/** Fulfil an outstanding line after stock has been replenished. */
export async function fulfilGuestAmenityShortage(tx: any, fulfillmentId: string, actorId: string) {
  // Serialize competing fulfilment clicks for the same line.
  await tx.$queryRaw`SELECT id FROM "GuestAmenityFulfillment" WHERE id = ${fulfillmentId}::uuid FOR UPDATE`;
  const fulfillment = await tx.guestAmenityFulfillment.findUnique({ where: { id: fulfillmentId } });
  if (!fulfillment) throw new Error('NOT_FOUND:Guest amenity fulfilment not found.');
  if (fulfillment.status === 'FULFILLED' || fulfillment.status === 'WAIVED' || fulfillment.status === 'VOIDED') return fulfillment;

  // The queue is for in-house guests only. Revalidate at the moment stock is
  // issued because a guest may have checked out after Night Audit created the
  // operational exception.
  const reservation = await tx.reservation.findUnique({ where: { id: fulfillment.reservationId }, select: { status: true } });
  if (!reservation || reservation.status !== 'CHECKED_IN') {
    return tx.guestAmenityFulfillment.update({
      where: { id: fulfillmentId },
      data: {
        status: 'VOIDED',
        reason: 'Voided because the guest is no longer checked in.',
        voidedAt: new Date(),
      },
    });
  }

  const remaining = Math.max(0, Number(fulfillment.requiredQuantity) - Number(fulfillment.issuedQuantity));
  if (remaining <= 0) {
    return tx.guestAmenityFulfillment.update({ where: { id: fulfillmentId }, data: { status: 'FULFILLED', shortageQuantity: 0, estimatedShortageValue: 0 } });
  }
  if (!fulfillment.stockItemId) {
    return tx.guestAmenityFulfillment.update({ where: { id: fulfillmentId }, data: { status: 'PENDING', reason: 'Stock item is not configured yet.' } });
  }

  const stock = await tx.stockItem.findUnique({ where: { id: fulfillment.stockItemId } });
  if (!stock || !stock.isActive) {
    return tx.guestAmenityFulfillment.update({ where: { id: fulfillmentId }, data: { status: 'PENDING', reason: 'Stock item is unavailable.' } });
  }

  const stockBefore = Number(stock.quantityOnHand || 0);
  const issueQuantity = Math.min(remaining, Math.max(0, stockBefore));
  if (issueQuantity <= 0) {
    return tx.guestAmenityFulfillment.update({ where: { id: fulfillmentId }, data: { status: 'PENDING', reason: 'No stock is currently available.' } });
  }

  const updated = await tx.stockItem.updateMany({
    where: { id: stock.id, isActive: true, quantityOnHand: { gte: issueQuantity } },
    data: { quantityOnHand: { decrement: issueQuantity } },
  });
  if (updated.count !== 1) throw new Error('CONFLICT:Stock changed before fulfilment could be completed. Retry.');

  const after = await tx.stockItem.findUnique({
    where: { id: stock.id },
    select: { quantityOnHand: true, costPrice: true, stockUnits: { select: { unit: true, unitsInBase: true, purchaseCost: true, isPurchaseUnit: true } } },
  });
  const unitCost = resolveInventoryUnitCost(after) || resolveInventoryUnitCost(stock);
  const stockOperationId = `${fulfillment.operationId}_REPLENISH_${String(fulfillment.issuedQuantity)}`;
  const value = issueQuantity * unitCost;
  await tx.stockTransaction.create({
    data: {
      propertyId: fulfillment.propertyId,
      stockItemId: stock.id,
      reservationId: fulfillment.reservationId,
      roomId: fulfillment.roomId,
      source: 'GUEST_AMENITY',
      quantity: -issueQuantity,
      unitCost,
      quantityBefore: stockBefore,
      quantityAfter: Number(after?.quantityOnHand || 0),
      totalValue: -value,
      currency: fulfillment.currency || 'NGN',
      warehouseId: fulfillment.warehouseId || stock.warehouseId,
      reference: fulfillment.reservationId,
      notes: 'Replenished complimentary guest amenity fulfilment',
      operationId: stockOperationId,
      userId: actorId,
      businessDate: fulfillment.businessDate,
    },
  });

  const issuedQuantity = Number(fulfillment.issuedQuantity) + issueQuantity;
  const shortageQuantity = Math.max(0, Number(fulfillment.requiredQuantity) - issuedQuantity);
  return tx.guestAmenityFulfillment.update({
    where: { id: fulfillmentId },
    data: {
      issuedQuantity,
      shortageQuantity,
      stockAfter: Number(after?.quantityOnHand || 0),
      unitCost: unitCost || fulfillment.unitCost,
      totalValue: Number(fulfillment.totalValue) + value,
      estimatedShortageValue: shortageQuantity * (unitCost || Number(fulfillment.unitCost)),
      status: shortageQuantity === 0 ? 'FULFILLED' : 'PARTIALLY_FULFILLED',
      reason: shortageQuantity === 0 ? null : 'Partially fulfilled; remaining quantity is still pending.',
      updatedAt: new Date(),
    },
  });
}

export async function waiveGuestAmenityShortage(tx: any, fulfillmentId: string, actorId: string, reason: string) {
  if (!reason || reason.trim().length < 5) throw new Error('A waiver reason of at least 5 characters is required.');
  const fulfillment = await tx.guestAmenityFulfillment.findUnique({ where: { id: fulfillmentId } });
  if (!fulfillment) throw new Error('NOT_FOUND:Guest amenity fulfilment not found.');
  if (['FULFILLED', 'WAIVED', 'VOIDED'].includes(fulfillment.status)) throw new Error('This fulfilment is already closed.');
  return tx.guestAmenityFulfillment.update({
    where: { id: fulfillmentId },
    data: { status: 'WAIVED', reason: `Waived by ${actorId}: ${reason.trim()}`, updatedAt: new Date() },
  });
}
