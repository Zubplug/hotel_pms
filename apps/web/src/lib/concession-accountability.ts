/** Staff positions allowed to acknowledge Front Desk concessions. */
export const CONCESSION_MANAGEMENT_POSITIONS = [
  'CEO', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER',
  'HOTEL_MANAGER', 'MANAGER', 'FRONT_DESK_MANAGER', 'FINANCE_MANAGER',
  'ACCOUNTANT', 'GENERAL_CASHIER', 'NIGHT_AUDITOR', 'FNB_MANAGER',
  'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'OUTLET_MANAGER',
  'DEPARTMENT_HEAD', 'HOD',
] as const;

export function normalizeStaffPosition(value: unknown) {
  return String(value || '').trim().toUpperCase().replace(/[ -]+/g, '_');
}

export function isConcessionManagementPosition(value: unknown) {
  return CONCESSION_MANAGEMENT_POSITIONS.includes(normalizeStaffPosition(value) as typeof CONCESSION_MANAGEMENT_POSITIONS[number]);
}
