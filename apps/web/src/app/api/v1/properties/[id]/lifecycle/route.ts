import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { createAuditLog } from '@/lib/audit';
import { requireEntitlement } from '@/lib/auth/entitlement';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };
const ORG_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'OWNER']);

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const { id } = await params;
  const ctx = await requireOrganizationContext(session.user.id);
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || property.organizationId !== ctx.organizationId) return errorResponse('NOT_FOUND', 'Property not found', 404);
  if (!ORG_ROLES.has(ctx.role)) return errorResponse('FORBIDDEN', 'Only organization administrators can change property lifecycle', 403);

  let body: { action?: string; reason?: string; targetOrganizationId?: string };
  try { body = await req.json(); } catch { return errorResponse('VALIDATION_ERROR', 'Invalid request body', 422); }
  const action = String(body.action || '').toUpperCase();
  const reason = String(body.reason || '').trim();
  if ((action === 'SUSPEND' || action === 'TRANSFER') && reason.length < 3) return errorResponse('VALIDATION_ERROR', 'A reason is required', 422);

  if (action === 'SUSPEND') {
    const updated = await prisma.property.update({ where: { id }, data: { isActive: false, suspendedAt: new Date(), suspensionReason: reason } });
    await createAuditLog({ organizationId: property.organizationId, propertyId: id, userId: session.user.id, action: 'PROPERTY_SUSPENDED', resource: 'property', resourceId: id, previousValue: property, newValue: updated });
    return successResponse(updated);
  }

  if (action === 'REACTIVATE') {
    try { await requireEntitlement(ctx.organizationId, 'MODULE_PMS', id); } catch { return errorResponse('PAYMENT_REQUIRED', 'An active PMS entitlement is required before reactivation', 402); }
    const updated = await prisma.property.update({ where: { id }, data: { isActive: true, suspendedAt: null, suspensionReason: null } });
    await createAuditLog({ organizationId: property.organizationId, propertyId: id, userId: session.user.id, action: 'PROPERTY_REACTIVATED', resource: 'property', resourceId: id, previousValue: property, newValue: updated });
    return successResponse(updated);
  }

  if (action === 'TRANSFER') {
    if (!(session.user as { isLodgeCoreAdmin?: boolean }).isLodgeCoreAdmin) return errorResponse('FORBIDDEN', 'Only LodgeCore HQ administrators can transfer properties between organizations', 403);
    const targetOrganizationId = String(body.targetOrganizationId || '');
    if (!targetOrganizationId || targetOrganizationId === property.organizationId) return errorResponse('VALIDATION_ERROR', 'A different target organization is required', 422);
    const target = await prisma.organization.findUnique({ where: { id: targetOrganizationId }, select: { id: true, name: true } });
    if (!target) return errorResponse('NOT_FOUND', 'Target organization not found', 404);
    const targetCount = await prisma.property.count({ where: { organizationId: targetOrganizationId, isActive: true } });
    try {
      const { requirePlanLimit } = await import('@/lib/auth/entitlement');
      await requirePlanLimit(targetOrganizationId, 'maxProperties', targetCount);
    } catch (error) { return errorResponse('CONFLICT', error instanceof Error ? error.message : 'Target organization property limit reached', 409); }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({ where: { id }, data: { organizationId: targetOrganizationId, isActive: false, suspendedAt: new Date(), suspensionReason: `Transferred from ${property.organizationId}: ${reason}` } });
      await tx.userRole.deleteMany({ where: { propertyId: id } });
      await tx.entitlement.updateMany({ where: { organizationId: property.organizationId, propertyId: id, status: 'ACTIVE' }, data: { status: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: 'Property transferred to another organization' } });
      const subscriptions = await tx.subscription.findMany({ where: { organizationId: property.organizationId, scopePropertyIds: { has: id } }, select: { id: true, scopePropertyIds: true } });
      for (const subscription of subscriptions) await tx.subscription.update({ where: { id: subscription.id }, data: { scopePropertyIds: subscription.scopePropertyIds.filter((propertyId) => propertyId !== id) } });
      const assignedStaff = await tx.staff.findMany({ where: { organizationId: property.organizationId, propertyAccess: { has: id } }, select: { id: true, propertyAccess: true } });
      for (const staff of assignedStaff) await tx.staff.update({ where: { id: staff.id }, data: { propertyAccess: staff.propertyAccess.filter((propertyId) => propertyId !== id) } });
      return updated;
    });
    await createAuditLog({ organizationId: targetOrganizationId, propertyId: id, userId: session.user.id, action: 'PROPERTY_TRANSFERRED', resource: 'property', resourceId: id, previousValue: { ...property, organizationId: property.organizationId }, newValue: { ...result, previousOrganizationId: property.organizationId, targetOrganizationId } });
    return successResponse(result);
  }

  return errorResponse('VALIDATION_ERROR', 'Action must be SUSPEND, REACTIVATE, or TRANSFER', 422);
}
