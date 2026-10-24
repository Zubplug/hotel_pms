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
    if (reason.length < 3 || reason.length > 500) return errorResponse('BAD_REQUEST', 'A suspension reason between 3 and 500 characters is required', 400);
    const id = (await context.params).id;
    const contract = await prisma.corporateContract.findFirst({ where: { id, organizationId, properties: { some: { propertyId: { in: [...propertyIds] }, status: 'ACTIVE' } } }, include: { properties: true } });
    if (!contract) return errorResponse('NOT_FOUND', 'Corporate contract not found', 404);
    const propertyId = contract.properties.find((item) => propertyIds.includes(item.propertyId))?.propertyId;
    if (!propertyId) return errorResponse('FORBIDDEN', 'Contract property is outside your scope', 403);
    if (!(await hasPermission(session.user.id, propertyId, 'corporate_account:edit'))) return errorResponse('FORBIDDEN', 'Missing corporate contract edit permission', 403);
    if (contract.status !== 'ACTIVE') return errorResponse('CONFLICT', `Only ACTIVE contracts can be suspended; current status is ${contract.status}`, 409);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CorporateContract" WHERE id = ${id}::uuid FOR UPDATE`;
      const updated = await tx.corporateContract.update({ where: { id }, data: { status: 'SUSPENDED' }, select: { id: true, status: true } });
      await tx.corporateContractVersion.updateMany({ where: { contractId: id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
      await tx.auditLog.create({ data: { organizationId, propertyId, userId: session.user.id, action: 'SUSPEND', resource: 'corporate_contract', resourceId: id, previousValue: { status: 'ACTIVE' }, newValue: { status: 'SUSPENDED', reason }, requestId: crypto.randomUUID() } });
      return updated;
    });
    return successResponse(result);
  } catch (error) {
    console.error('[corporate-contracts/suspend]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to suspend corporate contract', 500);
  }
}
