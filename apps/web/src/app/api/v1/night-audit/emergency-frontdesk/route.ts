import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/rbac';
import { lockOrchestrator } from '@/lib/locks/orchestrator';
import type { RoomStatus } from '@/lib/room-state-machine';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Night Audit decision point for browser emergency front-desk operations.
 * Cloud work is never duplicated here. Approval only releases the physical
 * card operation; rejection records an auditable decision and reverses the
 * emergency check-in state when it is still safe to do so.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const role = String((session.user as any).role || '').toUpperCase();
    if (!['NIGHT_AUDITOR', 'ACCOUNTANT', 'MANAGER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN'].includes(role)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await req.json();
    const propertyId = String(body.propertyId || '');
    const operationId = String(body.operationId || '');
    const decision = String(body.decision || '').toUpperCase();
    const reason = String(body.reason || '').trim();
    if (!propertyId || !operationId || !['APPROVE', 'REJECT', 'CONFIRM_CHECKOUT', 'REQUEST_REOPEN', 'AUTHORIZE_REOPEN'].includes(decision)) {
      return errorResponse('BAD_REQUEST', 'propertyId, operationId and a valid decision are required', 400);
    }
    if (['REJECT', 'REQUEST_REOPEN', 'AUTHORIZE_REOPEN'].includes(decision) && reason.length < 10) {
      return errorResponse('BAD_REQUEST', 'A rejection reason of at least 10 characters is required', 400);
    }
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Property access denied', 403);
    }
    if (!await hasPermission(session.user.id, 'night_audit', 'execute', propertyId)) {
      return errorResponse('FORBIDDEN', 'Night Audit permission required', 403);
    }

    const operation = await prisma.frontdeskEmergencyOperation.findUnique({ where: { id: operationId } });
    if (!operation || operation.propertyId !== propertyId) return errorResponse('NOT_FOUND', 'Emergency operation not found', 404);
    if (!['PENDING_NIGHT_AUDIT_REVIEW', 'CLOUD_COMPLETED_HARDWARE_PENDING', 'REJECTED_MANUAL_REVIEW', 'REOPEN_REQUESTED'].includes(operation.status)) {
      return successResponse({ operation, idempotent: true });
    }

    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);
    const now = new Date();

    const isCheckoutResolution = operation.operationType === 'CHECK_OUT' && ['CONFIRM_CHECKOUT', 'REQUEST_REOPEN', 'AUTHORIZE_REOPEN'].includes(decision);
    if (isCheckoutResolution && !['MANAGER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'SUPER_ADMIN'].includes(role)) {
      return errorResponse('FORBIDDEN', 'A manager is required to resolve a rejected checkout', 403);
    }

    if (decision === 'APPROVE' || decision === 'CONFIRM_CHECKOUT') {
      if (operation.operationType === 'CHECK_IN') {
        const lockOperationId = String((operation.metadata as any)?.lockOperationId || '');
        if (lockOperationId) {
          await prisma.lockOperation.updateMany({
            where: { id: lockOperationId, status: 'WAITING_FOR_AUDIT_APPROVAL' },
            data: { status: 'WAITING_FOR_CARD', metadata: { ...(operation.metadata as any), approvedByNightAudit: session.user.id, approvedAt: now } },
          });
        }
      } else if (operation.operationType === 'CHECK_OUT') {
        await lockOrchestrator.revokeReservationCredentials(operation.reservationId, propertyId);
      }
      const updated = await prisma.frontdeskEmergencyOperation.update({
        where: { id: operation.id },
        data: { status: 'APPROVED_HARDWARE_PENDING', cardEncodingStatus: operation.operationType === 'CHECK_IN' ? 'PENDING' : 'PENDING_REVOCATION', processedAt: now, metadata: { ...(operation.metadata as any), nightAuditDecision: decision, approvedBy: session.user.id, approvedAt: now } },
      });
      const pendingRun = await prisma.nightAudit.findFirst({ where: { propertyId, status: { in: ['PENDING', 'FAILED'] } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (pendingRun) await prisma.nightAuditAcknowledgement.create({ data: { nightAuditId: pendingRun.id, userId: session.user.id, warningType: 'EMERGENCY_FRONTDESK_OPERATIONS', reason: 'Reviewed emergency front-desk operation', comment: `Approved operation ${operation.id}` } });
      await prisma.auditLog.create({ data: { organizationId: property.organizationId, propertyId, userId: session.user.id, userEmail: session.user.email || 'unknown', userRole: role, action: 'FRONTDESK_EMERGENCY_APPROVED', resource: 'FrontdeskEmergencyOperation', resourceId: operation.id, previousValue: { status: operation.status }, newValue: { status: updated.status, physicalCardReleased: true }, requestId: crypto.randomUUID() } });
      return successResponse({ operation: updated });
    }

    if (decision === 'AUTHORIZE_REOPEN') {
      if (operation.operationType !== 'CHECK_OUT' || operation.status !== 'REOPEN_REQUESTED') {
        return errorResponse('CONFLICT', 'This operation is not awaiting authorised reopen.', 409);
      }
      const reopened = await prisma.$transaction(async (tx) => {
        const metadata = (operation.metadata || {}) as Record<string, any>;
        const originalCheckOut = metadata.originalCheckOut ? new Date(`${metadata.originalCheckOut}T00:00:00.000Z`) : new Date(operation.businessDate.getTime() + 86400000);
        const reservation = await tx.reservation.findFirst({ where: { id: operation.reservationId, propertyId, status: 'CHECKED_OUT' }, include: { reservationRooms: { where: { status: 'ACTIVE' }, select: { roomId: true } } } });
        if (!reservation) throw new Error('RESERVATION_NOT_REOPENABLE');
        await tx.reservation.update({ where: { id: reservation.id }, data: { status: 'CHECKED_IN', checkOut: originalCheckOut } });
        await tx.reservationRoom.updateMany({ where: { reservationId: reservation.id, status: 'ACTIVE' }, data: { checkOut: originalCheckOut } });
        for (const assignment of reservation.reservationRooms) {
          if (!assignment.roomId) continue;
          await tx.room.update({ where: { id: assignment.roomId }, data: { status: 'OCCUPIED' } });
          await tx.housekeepingTask.updateMany({ where: { roomId: assignment.roomId, type: 'CHECKOUT', status: { not: 'CANCELLED' }, createdAt: { gte: operation.createdAt } }, data: { status: 'CANCELLED', notes: 'Cancelled because the emergency checkout was authorised for reopen.' } });
        }
        await tx.folio.updateMany({ where: { reservationId: reservation.id, status: 'CLOSED' }, data: { status: 'OPEN', closedAt: null, closedBy: null, version: { increment: 1 } } });
        const updatedOperation = await tx.frontdeskEmergencyOperation.update({ where: { id: operation.id }, data: { status: 'REOPENED_FOR_CORRECTION', failureReason: null, processedAt: now, metadata: { ...metadata, finalDecision: 'AUTHORIZE_REOPEN', reopenedBy: session.user.id, reopenedAt: now.toISOString(), reopenReason: reason, financialState: 'POSTED_IMMUTABLE' } } });
        await tx.auditLog.create({ data: { organizationId: property.organizationId, propertyId, userId: session.user.id, userEmail: session.user.email || 'unknown', userRole: role, action: 'FRONTDESK_EMERGENCY_CHECKOUT_REOPENED', resource: 'FrontdeskEmergencyOperation', resourceId: operation.id, previousValue: { status: operation.status }, newValue: { status: updatedOperation.status, reservationStatus: 'CHECKED_IN', financialState: 'POSTED_IMMUTABLE', reason }, requestId: crypto.randomUUID() } });
        return updatedOperation;
      });
      return successResponse({ operation: reopened, reservationStatus: 'CHECKED_IN', financialCorrectionRequired: true });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (decision === 'REQUEST_REOPEN') {
        return tx.frontdeskEmergencyOperation.update({ where: { id: operation.id }, data: { status: 'REOPEN_REQUESTED', failureReason: reason, processedAt: now, metadata: { ...(operation.metadata as any), nightAuditDecision: decision, requestedBy: session.user.id, requestedAt: now, requestReason: reason } } });
      }
      if (operation.operationType === 'CHECK_IN') {
        await tx.reservation.updateMany({ where: { id: operation.reservationId, status: 'CHECKED_IN' }, data: { status: 'CONFIRMED' } });
        const previousRoomStatus = String((operation.metadata as any)?.previousRoomStatus || 'RESERVED');
        const restoredRoomStatus: RoomStatus = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED'].includes(previousRoomStatus)
          ? previousRoomStatus as RoomStatus
          : 'RESERVED';
        await tx.room.updateMany({ where: { id: String((operation.metadata as any)?.roomId || ''), status: 'OCCUPIED' }, data: { status: restoredRoomStatus } });
        await tx.lockOperation.updateMany({ where: { id: String((operation.metadata as any)?.lockOperationId || ''), status: { in: ['WAITING_FOR_AUDIT_APPROVAL', 'WAITING_FOR_CARD'] } }, data: { status: 'CANCELLED', metadata: { ...(operation.metadata as any), rejectedByNightAudit: session.user.id, rejectedAt: now, rejectionReason: reason } } });
        await tx.lockCredential.updateMany({ where: { issueOperationId: String((operation.metadata as any)?.lockOperationId || ''), status: 'PENDING' }, data: { status: 'CANCELLED', metadata: { source: 'ONLINE_FRONTDESK_EMERGENCY', rejectedByNightAudit: session.user.id, rejectionReason: reason } } });
      }
      return tx.frontdeskEmergencyOperation.update({ where: { id: operation.id }, data: { status: operation.operationType === 'CHECK_OUT' ? 'REJECTED_MANUAL_REVIEW' : 'REJECTED_REVERTED', cardEncodingStatus: 'CANCELLED', failureReason: reason, processedAt: now, metadata: { ...(operation.metadata as any), nightAuditDecision: 'REJECT', rejectedBy: session.user.id, rejectedAt: now } } });
    });
    const pendingRun = await prisma.nightAudit.findFirst({ where: { propertyId, status: { in: ['PENDING', 'FAILED'] } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (pendingRun) await prisma.nightAuditAcknowledgement.create({ data: { nightAuditId: pendingRun.id, userId: session.user.id, warningType: 'EMERGENCY_FRONTDESK_OPERATIONS', reason: 'Reviewed emergency front-desk operation', comment: `Rejected operation ${operation.id}: ${reason}` } });
    await prisma.auditLog.create({ data: { organizationId: property.organizationId, propertyId, userId: session.user.id, userEmail: session.user.email || 'unknown', userRole: role, action: 'FRONTDESK_EMERGENCY_REJECTED', resource: 'FrontdeskEmergencyOperation', resourceId: operation.id, previousValue: { status: operation.status }, newValue: { status: updated.status, reason }, requestId: crypto.randomUUID() } });
    if (operation.operationType === 'CHECK_OUT' && updated.status === 'REJECTED_MANUAL_REVIEW') {
      await prisma.approvalRequest.upsert({
        where: { idempotencyKey: `frontdesk-emergency-checkout-manager:${operation.id}` },
        create: {
          propertyId,
          type: 'FRONTDESK_EMERGENCY_CHECKOUT',
          status: 'PENDING',
          requestedBy: operation.requestedByUserId,
          reason,
          idempotencyKey: `frontdesk-emergency-checkout-manager:${operation.id}`,
          details: {
            operationId: operation.id,
            emergencyOperationId: operation.id,
            reservationId: operation.reservationId,
            businessDate: operation.businessDate.toISOString().slice(0, 10),
            rejectionReason: reason,
            stage: 'MANAGEMENT_REVIEW',
            financialState: 'POSTED_IMMUTABLE',
            decisionOptions: ['CONFIRM_CHECKOUT', 'REQUEST_REOPEN'],
          },
        },
        update: { status: 'PENDING', reason, reviewedBy: null, reviewedAt: null, details: { operationId: operation.id, emergencyOperationId: operation.id, reservationId: operation.reservationId, businessDate: operation.businessDate.toISOString().slice(0, 10), rejectionReason: reason, stage: 'MANAGEMENT_REVIEW', financialState: 'POSTED_IMMUTABLE', decisionOptions: ['CONFIRM_CHECKOUT', 'REQUEST_REOPEN'] } },
      });
    }
    return successResponse({ operation: updated });
  } catch (error: any) {
    console.error('[Night Audit emergency frontdesk decision]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to process emergency operation', 500);
  }
}
