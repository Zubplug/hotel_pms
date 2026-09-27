import db from '@hotel-pms/db';

export type AuditorScope = {
  id: string;
  organizationId: string;
  propertyId: string;
  propertyName?: string;
  currency?: string;
  auditPeriodStart: Date;
  auditPeriodEnd: Date;
  accessStartsAt: Date;
  accessExpiresAt: Date;
};

/**
 * Retrieves the active external auditor scope for a given user.
 * Throws an error if no active or valid access exists.
 */
export async function getExternalAuditorScopes(userId: string): Promise<AuditorScope[]> {
  const access = await db.externalAuditorAccess.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      accessStartsAt: { lte: new Date() },
      accessExpiresAt: {
        gte: new Date(),
      },
    },
    include: { property: { select: { name: true, baseCurrency: true } } },
    orderBy: [{ auditPeriodStart: 'asc' }, { propertyId: 'asc' }],
  });

  return access.map((item) => ({
    id: item.id,
    organizationId: item.organizationId,
    propertyId: item.propertyId,
    propertyName: item.property.name,
    currency: item.property.baseCurrency,
    auditPeriodStart: item.auditPeriodStart,
    auditPeriodEnd: item.auditPeriodEnd,
    accessStartsAt: item.accessStartsAt,
    accessExpiresAt: item.accessExpiresAt,
  }));
}

export async function getExternalAuditorScope(userId: string, propertyId: string): Promise<AuditorScope> {
  const access = (await getExternalAuditorScopes(userId)).find((item) => item.propertyId === propertyId);
  if (!access) {
    throw new Error('403 Forbidden: No active audit engagement for this property or access has expired.');
  }
  return access;
}

/**
 * Validates that the requested property matches the scope and that the entity's
 * authoritative businessDate falls within the audit period.
 */
export function assertAuditorAccess(scope: AuditorScope, propertyId: string, businessDate: Date | null | undefined) {
  if (scope.propertyId !== propertyId) {
    throw new Error('403 Forbidden: Property does not match audit scope.');
  }

  if (!businessDate) {
    throw new Error('403 Forbidden: Business date is required for audit validation.');
  }

  const dateKey = new Date(businessDate).toISOString().slice(0, 10);
  const startKey = new Date(scope.auditPeriodStart).toISOString().slice(0, 10);
  const endKey = new Date(scope.auditPeriodEnd).toISOString().slice(0, 10);
  if (dateKey < startKey || dateKey > endKey) {
    throw new Error('403 Forbidden: Requested record falls outside the permitted audit period.');
  }
}

/**
 * Explicitly denies state-changing operations for the EXTERNAL_AUDITOR role.
 */
export function assertCanMutate(session: any) {
  if (String(session?.user?.role || '').toUpperCase() === 'EXTERNAL_AUDITOR') {
    throw new Error('403 Forbidden: External Auditors are restricted to read-only operations.');
  }
}

export function isExternalAuditor(session: any) {
  return String(session?.user?.role || '').toUpperCase() === 'EXTERNAL_AUDITOR';
}
