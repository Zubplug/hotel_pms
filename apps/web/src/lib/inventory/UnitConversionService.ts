import { UnitOfMeasure } from '@hotel-pms/db';

export async function resolveStockUnitConversion(db: any, stockItemId: string, unit: UnitOfMeasure) {
  const stockItem = await db.stockItem.findUnique({
    where: { id: stockItemId },
    select: { baseUnit: true, stockUnits: { where: { unit }, select: { unitsInBase: true } } },
  });
  if (!stockItem) throw new Error('Stock item not found');
  if (unit === stockItem.baseUnit) return 1;
  if (['UNIT', 'EACH', 'PIECE'].includes(unit) && ['UNIT', 'EACH', 'PIECE'].includes(stockItem.baseUnit)) return 1;
  const conversion = stockItem.stockUnits[0];
  if (!conversion) throw new Error(`No conversion configured for ${unit} to ${stockItem.baseUnit}`);
  return Number(conversion.unitsInBase);
}

/** Validate a recipe/modifier issue unit and return its base-unit multiplier. */
export async function requireStockUnitConversion(db: any, stockItemId: string, unit: UnitOfMeasure | string) {
  if (!unit) throw new Error('A deduction unit is required');
  const multiplier = await resolveStockUnitConversion(db, stockItemId, unit as UnitOfMeasure);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(`Invalid conversion for ${unit}`);
  }
  return multiplier;
}
