export const INVENTORY_UNITS = [
  'UNIT', 'EACH', 'PIECE', 'PAIR', 'SET',
  'KG', 'GRAM', 'TONNE', 'LITRE', 'ML', 'GALLON',
  'BOTTLE', 'CAN', 'JAR', 'TIN', 'SACHET',
  'BOX', 'PACK', 'CART', 'CARTON', 'CASE', 'PALLET',
  'BAG', 'BUNDLE', 'ROLL', 'DOZEN',
] as const;

export function formatUnit(unit: string) {
  return unit.charAt(0) + unit.slice(1).toLowerCase();
}

export type PurchaseUnitLike = { unit: string; unitsInBase: unknown; purchaseCost?: unknown; isPurchaseUnit?: boolean };

/** Monetary values entered as purchase prices are currency values, not raw floats. */
export function roundCurrency(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function purchaseSetup(baseUnit: string, stockUnits: PurchaseUnitLike[] = []) {
  const configured = stockUnits.find((unit) => unit.isPurchaseUnit);
  return {
    unit: configured?.unit || baseUnit,
    unitsInBase: Number(configured?.unitsInBase || 1),
    purchaseCost: configured?.purchaseCost == null ? null : Number(configured.purchaseCost),
  };
}

export function toPurchaseQuantity(baseQuantity: unknown, baseUnit: string, stockUnits: PurchaseUnitLike[] = []) {
  const setup = purchaseSetup(baseUnit, stockUnits);
  return Number(baseQuantity || 0) / setup.unitsInBase;
}

export function toPurchaseCost(baseCost: unknown, baseUnit: string, stockUnits: PurchaseUnitLike[] = []) {
  const setup = purchaseSetup(baseUnit, stockUnits);
  return roundCurrency(setup.purchaseCost ?? Number(baseCost || 0) * setup.unitsInBase);
}
