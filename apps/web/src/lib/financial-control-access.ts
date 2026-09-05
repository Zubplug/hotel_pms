export const CASH_HANDOVER_ROLES = [
  'GENERAL_CASHIER', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER',
  'ACCOUNTANT', 'CEO', 'SUPER_ADMIN', 'NIGHT_AUDITOR'
] as const;

export const DEPOSIT_SUBMIT_ROLES = CASH_HANDOVER_ROLES;

export const DEPOSIT_VERIFY_ROLES = [
  'FINANCE_MANAGER', 'MANAGER', 'HOTEL_MANAGER', 'ACCOUNTANT',
  'CEO', 'SUPER_ADMIN'
] as const;

export function hasFinancialRole(role: unknown, allowed: readonly string[]) {
  return allowed.includes(String(role || '').toUpperCase());
}
