import { NextRequest } from 'next/server';
import crypto from 'crypto';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const { id } = await context.params;

    const contract: any = await prisma.corporateContract.findFirst({
      where: { id, organizationId, properties: { some: { propertyId: { in: [...propertyIds] }, status: 'ACTIVE' } } },
      include: { properties: true, versions: { where: { status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } }, orderBy: { version: 'desc' }, take: 1, include: { rules: true } } },
    });
    if (!contract) return errorResponse('NOT_FOUND', 'Corporate contract not found', 404);
    const propertyId = contract.properties.find((property: { propertyId: string }) => propertyIds.includes(property.propertyId))?.propertyId;
    if (!propertyId) return errorResponse('FORBIDDEN', 'Contract property is outside your scope', 403);
    if (!(await hasPermission(session.user.id, propertyId, 'corporate_account:edit'))) return errorResponse('FORBIDDEN', 'Missing corporate contract approval permission', 403);
    if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(contract.status)) return errorResponse('CONFLICT', `Only DRAFT, SUBMITTED, or APPROVED contracts can be activated; current status is ${contract.status}`, 409);
    const version = contract.versions[0];
    if (!version) return errorResponse('CONFLICT', 'Contract has no draft version to activate', 409);
    if (version.rules.length === 0) return errorResponse('CONFLICT', 'Contract version has no room-type rules', 409);
    if (new Set(version.rules.map((rule: { roomTypeId: string }) => rule.roomTypeId)).size !== version.rules.length) return errorResponse('CONFLICT', 'Contract version contains duplicate room-type rules', 409);

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "CorporateContract" WHERE id = ${contract.id}::uuid FOR UPDATE`;
      const conflict = await tx.corporateContract.findFirst({
        where: {
          id: { not: contract.id }, organizationId, ...(contract.corporateAccountId ? { corporateAccountId: contract.corporateAccountId } : { corporateBookingApplicationId: contract.corporateBookingApplicationId }), status: 'ACTIVE',
          effectiveFrom: { lte: contract.effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: contract.effectiveFrom } }],
          properties: { some: { propertyId, status: 'ACTIVE' } },
        },
        select: { id: true, reference: true },
      });
      if (conflict) throw Object.assign(new Error(`An active contract already overlaps this account and property: ${conflict.reference}`), { code: 'CONTRACT_CONFLICT' });
      await tx.corporateContractVersion.update({ where: { id: version.id }, data: { status: 'ACTIVE', approvedBy: session.user.id, approvedAt: new Date() } });
      await tx.corporateContract.update({ where: { id: contract.id }, data: { status: 'ACTIVE' } });
      await tx.auditLog.create({ data: { organizationId, propertyId, userId: session.user.id, action: 'APPROVE', resource: 'corporate_contract', resourceId: contract.id, newValue: { contractId: contract.id, versionId: version.id, status: 'ACTIVE' }, requestId: crypto.randomUUID() } });
      return { contractId: contract.id, versionId: version.id, status: 'ACTIVE' };
    }, { isolationLevel: 'Serializable' });
    return successResponse(result);
  } catch (error) {
    if ((error as any)?.code === 'CONTRACT_CONFLICT') return errorResponse('CONFLICT', (error as Error).message, 409);
    console.error('[corporate-contracts/activate]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to activate corporate contract', 500);
  }
}
