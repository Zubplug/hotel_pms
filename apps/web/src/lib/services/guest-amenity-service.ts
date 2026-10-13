type AmenityDefinition = {
  key: string;
  name: string;
  aliases: string[];
  quantityPerGuest: number;
  expectedCost: number;
};

export const DEFAULT_GUEST_AMENITY_PACK: AmenityDefinition[] = [
  // Complimentary water and Bottle Water are separate stock items. Keep the
  // legacy spelling as an alias, but never alias Bottle Water into this pack.
  { key: 'complimentary-water', name: 'Complimentary Water', aliases: ['complimentry water', 'complimentary water', 'complementary water'], quantityPerGuest: 1, expectedCost: 125 },
  { key: 'sachet-milk', name: 'Sachet Milk', aliases: ['sachet milk', 'satchet milk'], quantityPerGuest: 1, expectedCost: 162 },
  { key: 'milo', name: 'Milo', aliases: ['milo'], quantityPerGuest: 1, expectedCost: 175 },
  { key: 'sugar', name: 'Sugar', aliases: ['sugar'], quantityPerGuest: 1, expectedCost: 30 },
];

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function resolveDefinitions(settings: any): AmenityDefinition[] {
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
  const definitions = resolveDefinitions(settings);
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
      : [definition.name, ...definition.aliases].some((name) => normalize(name) === normalize(item.name)));
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

    const after = await tx.stockItem.findUnique({ where: { id: stock.id }, select: { quantityOnHand: true, costPrice: true } });
    // Inventory cost is authoritative. The supplied standard costs are safe
    // defaults for a newly created item whose cost has not been initialized.
    const inventoryCost = Number(after?.costPrice ?? stock.costPrice ?? 0);
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
