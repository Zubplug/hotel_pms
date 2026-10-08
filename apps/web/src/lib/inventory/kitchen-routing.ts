export const CENTRAL_KITCHEN_STOCK_TYPES = new Set(['RAW_MATERIAL']);

type PropertySettings = unknown;

export function kitchenServiceOutletId(settings: PropertySettings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const inventory = (settings as Record<string, unknown>).inventory;
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) return null;
  const value = (inventory as Record<string, unknown>).kitchenServiceOutletId;
  return typeof value === 'string' && value.trim() ? value : null;
}

export function isCentralKitchenStock(stockType: string | null | undefined) {
  return CENTRAL_KITCHEN_STOCK_TYPES.has(String(stockType || '').toUpperCase());
}
