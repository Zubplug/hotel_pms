import { auth } from '@/lib/auth';

export async function requireEventContext() {
  const session = await auth();
  if (!session?.user?.id || !session.user.propertyId) {
    throw new Error('Authentication and an assigned property are required.');
  }

  return {
    userId: session.user.id,
    propertyId: session.user.propertyId,
  };
}

export type EventRoleGroup = 'FNB' | 'ACCOUNTING' | 'CASHIER';

const EVENT_ROLES: Record<EventRoleGroup, ReadonlySet<string>> = {
  FNB: new Set(['FNB_MANAGER', 'EVENT_MANAGER', 'BANQUET_MANAGER', 'RESTAURANT_MANAGER']),
  ACCOUNTING: new Set(['ACCOUNTANT', 'FINANCE_MANAGER']),
  CASHIER: new Set(['GENERAL_CASHIER']),
};

/** Require the authenticated user to have the role for the requested segregation-of-duties step. */
export async function requireEventRole(group: EventRoleGroup) {
  const session = await auth();
  if (!session?.user?.id || !session.user.propertyId) {
    throw new Error('Authentication and an assigned property are required.');
  }
  const user = session.user as typeof session.user & { role?: string; isSuperAdmin?: boolean; isLodgeCoreAdmin?: boolean };
  const role = String(user.role || '').toUpperCase();
  const privileged = Boolean(user.isSuperAdmin || user.isLodgeCoreAdmin || ['ADMIN', 'SUPER_ADMIN', 'HOTEL_MANAGER', 'CEO'].includes(role));
  if (!privileged && !EVENT_ROLES[group].has(role)) {
    throw new Error(`This action requires ${group.toLowerCase()} authorization.`);
  }
  return { userId: user.id!, propertyId: user.propertyId!, role };
}
