export const INVENTORY_UNITS = [
  'UNIT', 'EACH', 'PIECE', 'PAIR', 'SET',
  'KG', 'GRAM', 'TONNE', 'LITRE', 'ML', 'GALLON',
  'BOTTLE', 'CAN', 'JAR', 'TIN', 'SACHET',
  'BOX', 'PACK', 'CARTON', 'CASE', 'PALLET',
  'BAG', 'BUNDLE', 'ROLL', 'DOZEN',
] as const;

export function formatUnit(unit: string) {
  return unit.charAt(0) + unit.slice(1).toLowerCase();
}
