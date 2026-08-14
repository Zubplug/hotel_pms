import prisma from '@hotel-pms/db';

export interface AuditLogParams {
  organizationId: string;
  propertyId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        propertyId: params.propertyId,
        userId: params.userId,
        userEmail: params.userEmail,
        userRole: params.userRole,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        previousValue: params.previousValue ? JSON.parse(JSON.stringify(params.previousValue)) : undefined,
        newValue: params.newValue ? JSON.parse(JSON.stringify(params.newValue)) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId ?? crypto.randomUUID(),
      },
    });
  } catch (err) {
    // Audit failures must never crash the main request
    console.error('[Audit] Failed to write audit log:', err);
  }
}
