import prisma from '@hotel-pms/db';

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
    select: { settings: true, baseCurrency: true },
  });
  if (!property) throw new Error('NOT_FOUND:Property not found');

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

  const blockers = [
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
    blockers,
    currency: property.baseCurrency || 'NGN',
  };
}

/**
 * Deducts the complimentary in-room amenity pack from the property's stock.
 * The guest is not charged. Each operation is unique per reservation/date/item
 * so retries and offline/cloud replay cannot consume stock twice.
 */
export async function postGuestAmenityPackInTransaction(
  tx: any,
  input: {
    propertyId: string;
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
  if (!definitions.length) return { itemCount: 0, totalCost: 0 };

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
  if (!targetWarehouse) {
    throw new Error('GUEST_AMENITY_WAREHOUSE_MISSING: Configure an active housekeeping/laundry stock outlet warehouse for guest amenities.');
  }

  const candidates = await tx.stockItem.findMany({
    where: { propertyId: input.propertyId, warehouseId: targetWarehouse.id, isActive: true },
    include: { warehouse: { select: { id: true, name: true } }, stockUnits: true },
  });
  let itemCount = 0;
  let totalCost = 0;
  const currency = property.baseCurrency || property.supportedCurrencies?.[0] || 'NGN';

  for (const definition of definitions) {
    if (!definition.name || definition.quantityPerGuest <= 0) continue;
    const configuredId = (definition as any).stockItemId as string | undefined;
    const matches = candidates.filter((item: any) => configuredId
      ? item.id === configuredId
      : [definition.name, ...definition.aliases].some((name) => normalizeGuestAmenityName(name) === normalizeGuestAmenityName(item.name)));
    const stock = matches[0];
    if (!stock) {
      throw new Error(`GUEST_AMENITY_STOCK_MISSING: ${definition.name} is not configured in the ${targetWarehouse.name} warehouse.`);
    }

    const required = definition.quantityPerGuest * Math.max(1, input.guestCount);
    const operationId = `GUEST_AMENITY_${input.reservationId}_${input.businessDate.toISOString().slice(0, 10)}_${stock.id}`;
    if (await tx.stockTransaction.findUnique({ where: { operationId } })) continue;

    // Amenity quantities are configured in the stock item's base unit. For
    // example, one bottle or one sachet is one base-unit issue.
    const requiredInBase = required;
    const updated = await tx.stockItem.updateMany({
      where: { id: stock.id, isActive: true, quantityOnHand: { gte: requiredInBase } },
      data: { quantityOnHand: { decrement: requiredInBase } },
    });
    if (updated.count !== 1) {
      throw new Error(`INSUFFICIENT_GUEST_AMENITY_STOCK: ${stock.name} requires ${requiredInBase} ${stock.baseUnit}, but available stock is insufficient.`);
    }

    const after = await tx.stockItem.findUnique({
      where: { id: stock.id },
      select: {
        quantityOnHand: true,
        costPrice: true,
        stockUnits: { select: { unit: true, unitsInBase: true, purchaseCost: true, isPurchaseUnit: true } },
      },
    });
    // Inventory cost is authoritative. The supplied standard costs are safe
    // defaults for a newly created item whose cost has not been initialized.
    const inventoryCost = resolveInventoryUnitCost(after) || resolveInventoryUnitCost(stock);
    const unitCost = inventoryCost > 0 ? inventoryCost : definition.expectedCost;
    const totalValue = requiredInBase * unitCost;
    await tx.stockTransaction.create({
      data: {
        propertyId: input.propertyId,
        stockItemId: stock.id,
        reservationId: input.reservationId,
        roomId: input.roomId || null,
        source: 'GUEST_AMENITY',
        quantity: -requiredInBase,
        unitCost,
        quantityBefore: Number(after?.quantityOnHand || 0) + requiredInBase,
        quantityAfter: Number(after?.quantityOnHand || 0),
        totalValue: -totalValue,
        currency,
        warehouseId: stock.warehouseId,
        reference: input.reservationId,
        notes: `Complimentary guest amenity pack for ${input.guestCount} registered guest(s)`,
        operationId,
        userId: input.actorId,
        businessDate: input.businessDate,
      },
    });
    itemCount++;
    totalCost += totalValue;
  }

  return { itemCount, totalCost };
}
