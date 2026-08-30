import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate } from '@/lib/date-utils';

/**
 * Financial operations may continue during audit preparation. Once the audit
 * run is IN_PROGRESS, however, no new transaction may be posted to that
 * business date. Read-only requests and guest-service workflows are unaffected.
 */
export async function isNightAuditTransactionLocked(propertyId: string, businessDate?: Date | null) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { businessDate: true, timezone: true },
  });
  if (!property) return false;

  const effectiveDate = businessDate || property.businessDate || getPropertyBusinessDate(property.timezone);
  const activeRun = await prisma.nightAudit.findFirst({
    where: { propertyId, businessDate: effectiveDate, status: { in: ['IN_PROGRESS', 'POSTING'] } },
    select: { id: true },
  });
  return Boolean(activeRun);
}

/** True while any audit phase is active, including post-rollover processing. */
export async function isNightAuditCutoverActive(propertyId: string) {
  const activeRun = await prisma.nightAudit.findFirst({
    where: { propertyId, status: { in: ['IN_PROGRESS', 'POSTING'] } },
    select: { id: true },
  });
  return Boolean(activeRun);
}

/**
 * Use this at service boundaries for operations that create or settle money.
 * Route checks are useful for user feedback, but the service boundary is the
 * protection that prevents a new caller from accidentally bypassing audit.
 */
export async function assertNightAuditAllowsTransaction(propertyId: string, businessDate?: Date | null) {
  if (await isNightAuditTransactionLocked(propertyId, businessDate)) {
    const error = new Error('NIGHT_AUDIT_IN_PROGRESS:Business-date transactions are temporarily locked while Night Audit is posting.');
    (error as Error & { code?: string; status?: number }).code = 'NIGHT_AUDIT_IN_PROGRESS';
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
}

export function canOverrideNightAudit(role: unknown) {
  return ['SUPER_ADMIN', 'CEO', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER'].includes(String(role || '').toUpperCase());
}

export function getNightAuditOverrideReason(value: unknown) {
  const reason = typeof value === 'string' ? value.trim() : '';
  return reason.length >= 10 ? reason : null;
}
