import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!['ADMIN', 'SUPER_ADMIN'].includes(String(user.role).toUpperCase()) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Administrator approval is required to complete account deletion.', 403);
    const { id } = await params;
    const result = await prisma.$transaction(async (tx) => {
      const approval = await tx.approvalRequest.findUnique({ where: { id } });
      if (!approval || approval.type !== 'ACCOUNT_DELETION') throw new Error('NOT_FOUND');
      if (!user.allowedProperties.includes(approval.propertyId)) throw new Error('FORBIDDEN');
      const details = (approval.details || {}) as Record<string, any>;
      if (approval.status !== 'APPROVED' || details.deletionStatus !== 'AWAITING_DATA_REVIEW') throw new Error('NOT_READY');
      const staff = await tx.staff.findUnique({ where: { id: approval.requestedBy }, select: { id: true, userId: true } });
      if (!staff) throw new Error('STAFF_NOT_FOUND');
      const completedAt = new Date();
      const anonymizedEmail = `deleted-${staff.id}@privacy.lodgecore.invalid`;
      await tx.staff.update({ where: { id: staff.id }, data: { firstName: 'Deleted', lastName: 'User', email: anonymizedEmail, phone: null, posPinHash: null, propertyAccess: [], isActive: false, deletedAt: completedAt } });
      if (staff.userId) await tx.user.update({ where: { id: staff.userId }, data: { email: anonymizedEmail, passwordHash: crypto.randomBytes(48).toString('hex'), passwordSetAt: null, mobilePinHash: null, mobilePinSetAt: null, mobilePinFailedAttempts: 0, mobilePinLockedUntil: null, mfaEnabled: false, mfaSecret: null, sessionVersion: { increment: 1 } } });
      const updated = await tx.approvalRequest.update({ where: { id: approval.id }, data: { details: { ...details, stage: 'COMPLETED', deletionStatus: 'FULFILLED', dataDeleted: true, fulfilledAt: completedAt.toISOString(), fulfilledBy: user.id, retainedRecords: ['hotel operational history', 'financial and payment records', 'audit and security records where required'] } } });
      const property = await tx.property.findUnique({ where: { id: approval.propertyId }, select: { organizationId: true } });
      await tx.auditLog.create({ data: { organizationId: property?.organizationId || '', propertyId: approval.propertyId, userId: user.id, action: 'ACCOUNT_DELETION_FULFILLED', resource: 'ApprovalRequest', resourceId: approval.id, newValue: { staffId: staff.id, userId: staff.userId, dataDeleted: true, identityAnonymized: true, retainedRecords: true }, ipAddress: req.headers.get('x-forwarded-for') || '', userAgent: req.headers.get('user-agent') || '', requestId: crypto.randomUUID() } });
      return updated;
    });
    return successResponse({ status: 'FULFILLED', dataDeleted: true, approvalId: result.id, message: 'Eligible account identity data was deleted or anonymised. Required hotel, financial, audit, and security records were retained.' }, 200);
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Account deletion request not found', 404);
    if (error.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'Access denied for this property', 403);
    if (error.message === 'NOT_READY') return errorResponse('CONFLICT', 'This request must be manager-approved and awaiting data review.', 409);
    if (error.message === 'STAFF_NOT_FOUND') return errorResponse('NOT_FOUND', 'The linked staff account no longer exists.', 404);
    console.error('[Account deletion fulfilment]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to complete account deletion', 500);
  }
}
