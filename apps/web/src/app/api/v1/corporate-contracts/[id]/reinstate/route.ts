import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 3 || reason.length > 500) return errorResponse('BAD_REQUEST', 'A reinstatement reason between 3 and 500 characters is required', 400);
    const id = (await context.params).id;
    const contract = await prisma.corporateContract.findFirst({ where: { id, organizationId, properties: { some: { propertyId: { in: [...propertyIds] }, status: 'ACTIVE' } } }, include: { properties: true, versions: { where: { status: 'EXPIRED' }, orderBy: { version: 'desc' }, take: 1, include: { rules: true } } } });
    if (!contract) return errorResponse('NOT_FOUND', 'Corporate contract not found', 404);
    const propertyId = contract.properties.find((item) => propertyIds.includes(item.propertyId))?.propertyId;
    if (!propertyId) return errorResponse('FORBIDDEN', 'Contract property is outside your scope', 403);
    if (!(await hasPermission(session.user.id, propertyId, 'corporate_account:edit'))) return errorResponse('FORBIDDEN', 'Missing corporate contract edit permission', 403);
    if (contract.status !== 'SUSPENDED') return errorResponse('CONFLICT', `Only SUSPENDED contracts can be reinstated; current status is ${contract.status}`, 409);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CorporateContract" WHERE id = ${id}::uuid FOR UPDATE`;
      const conflict = await tx.corporateContract.findFirst({ where: { id: { not: id }, organizationId, ...(contract.corporateAccountId ? { corporateAccountId: contract.corporateAccountId } : { corporateBookingApplicationId: contract.corporateBookingApplicationId }), status: 'ACTIVE', effectiveFrom: { lte: contract.effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: contract.effectiveFrom } }], properties: { some: { propertyId, status: 'ACTIVE' } } }, select: { reference: true } });
      if (conflict) throw Object.assign(new Error(`An active contract already overlaps this identity: ${conflict.reference}`), { code: 'CONTRACT_CONFLICT' });
      const version = contract.versions[0];
      if (!version || version.rules.length === 0) throw Object.assign(new Error('Suspended contract has no restorable rate version'), { code: 'NO_VERSION' });
      await tx.corporateContractVersion.update({ where: { id: version.id }, data: { status: 'ACTIVE' } });
      const updated = await tx.corporateContract.update({ where: { id }, data: { status: 'ACTIVE' }, select: { id: true, status: true } });
      await tx.auditLog.create({ data: { organizationId, propertyId, userId: session.user.id, action: 'REINSTATE', resource: 'corporate_contract', resourceId: id, previousValue: { status: 'SUSPENDED' }, newValue: { status: 'ACTIVE', reason }, requestId: crypto.randomUUID() } });
      return updated;
    }, { isolationLevel: 'Serializable' });
    return successResponse(result);
  } catch (error: any) {
    if (error?.code === 'CONTRACT_CONFLICT' || error?.code === 'NO_VERSION') return errorResponse('CONFLICT', error.message, 409);
    console.error('[corporate-contracts/reinstate]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to reinstate corporate contract', 500);
  }
}
