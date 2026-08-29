import { UnitOfMeasure } from '@hotel-pms/db';

export async function resolveStockUnitConversion(db: any, stockItemId: string, unit: UnitOfMeasure) {
  const stockItem = await db.stockItem.findUnique({
    where: { id: stockItemId },
    select: { baseUnit: true, stockUnits: { where: { unit }, select: { unitsInBase: true } } },
  });
  if (!stockItem) throw new Error('Stock item not found');
  if (unit === stockItem.baseUnit) return 1;
  const conversion = stockItem.stockUnits[0];
  if (!conversion) throw new Error(`No conversion configured for ${unit} to ${stockItem.baseUnit}`);
  return Number(conversion.unitsInBase);
}
