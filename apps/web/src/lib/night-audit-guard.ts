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
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { businessDate: true, timezone: true } });
  const effectiveDate = businessDate || property?.businessDate || (property ? getPropertyBusinessDate(property.timezone) : null);
  if (property?.businessDate && effectiveDate && effectiveDate.getTime() < property.businessDate.getTime()) {
    const error = new Error('CLOSED_BUSINESS_DATE:This business date is closed. Use the controlled late-posting workflow with an approved reason.');
    (error as Error & { code?: string; status?: number }).code = 'CLOSED_BUSINESS_DATE';
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
  if (await isNightAuditTransactionLocked(propertyId, businessDate)) {
    const error = new Error('NIGHT_AUDIT_IN_PROGRESS:Business-date transactions are temporarily locked while Night Audit is posting.');
    (error as Error & { code?: string; status?: number }).code = 'NIGHT_AUDIT_IN_PROGRESS';
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
}

/**
 * Shift creation is stricter than ordinary transaction posting. If the
 * property's business date is still before its local calendar date, the
 * previous day's Night Audit has not advanced the property and a new till or
 * POS bank must not be created on the stale date.
 *
 * Closing/reconciling the existing shift and running Night Audit remain
 * available; callers should use this only at shift/session creation.
 */
export async function assertCanOpenShift(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { businessDate: true, timezone: true },
  });
  if (!property) return;

  const today = getPropertyBusinessDate(property.timezone);
  const businessDate = property.businessDate || today;
  if (businessDate.getTime() < today.getTime()) {
    const error = new Error(
      `NIGHT_AUDIT_REQUIRED:Night Audit is still pending for business date ${businessDate.toISOString().slice(0, 10)}. Complete it before opening a new shift.`
    );
    (error as Error & { code?: string; status?: number }).code = 'NIGHT_AUDIT_REQUIRED';
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  if (await isNightAuditTransactionLocked(propertyId, businessDate)) {
    const error = new Error('NIGHT_AUDIT_IN_PROGRESS:Night Audit is posting. Open a new shift after it completes.');
    (error as Error & { code?: string; status?: number }).code = 'NIGHT_AUDIT_IN_PROGRESS';
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
}

/**
 * Validate a delayed offline session-open event. Historical events may arrive
 * after Night Audit has advanced the property date, so they remain acceptable
 * when the event was actually created on (or before) the session's business
 * date. A client that opens yesterday's shift after midnight produces an
 * occurredAt date newer than the session date and is rejected.
 */
export function assertOfflineSessionOpenDate(input: {
  propertyBusinessDate: Date;
  sessionBusinessDate: Date;
  occurredAt: Date;
  timezone: string;
}) {
  const propertyDate = new Date(input.propertyBusinessDate);
  propertyDate.setUTCHours(0, 0, 0, 0);
  const sessionDate = new Date(input.sessionBusinessDate);
  sessionDate.setUTCHours(0, 0, 0, 0);

  if (Number.isNaN(propertyDate.getTime()) || Number.isNaN(sessionDate.getTime()) || Number.isNaN(input.occurredAt.getTime())) {
    throw new Error('BAD_REQUEST:Offline shift dates are invalid.');
  }
  const occurredDate = getPropertyBusinessDate(input.timezone, input.occurredAt);

  if (sessionDate.getTime() > propertyDate.getTime()) {
    throw new Error('NIGHT_AUDIT_REQUIRED:Offline shift belongs to a business date that is ahead of the property date. Refresh before opening a shift.');
  }
  if (occurredDate.getTime() > sessionDate.getTime()) {
    throw new Error(`NIGHT_AUDIT_REQUIRED:Offline shift was opened on ${occurredDate.toISOString().slice(0, 10)} but is assigned to business date ${sessionDate.toISOString().slice(0, 10)}. Complete Night Audit and refresh the terminal before opening a new shift.`);
  }
}

export function canOverrideNightAudit(role: unknown) {
  return ['SUPER_ADMIN', 'CEO', 'MANAGER', 'HOTEL_MANAGER', 'FINANCE_MANAGER'].includes(String(role || '').toUpperCase());
}

export function getNightAuditOverrideReason(value: unknown) {
  const reason = typeof value === 'string' ? value.trim() : '';
  return reason.length >= 10 ? reason : null;
}
