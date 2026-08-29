import prisma from '@hotel-pms/db';
import crypto from 'crypto';
import { ShiftControlError } from './shift-control-service';

export class CashHandoverService {
  /**
   * General Cashier initiates a handover to take custody of an operator's approved shift,
   * or an operator initiates it to transfer to a safe.
   */
  static async createHandover(params: {
    propertyId: string;
    creatorId: string;
    posSessionIds: string[];
    frontdeskSessionIds: string[];
    safeReference?: string;
    notes?: string;
    idempotencyKey?: string;
  }) {
    return prisma.$transaction(async tx => {
      if (params.idempotencyKey) {
        const existing = await tx.cashHandover.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
        if (existing) return existing;
      }
      // 1. Fetch POS Sessions
      const posSessions = params.posSessionIds.length > 0 
        ? await tx.posSession.findMany({ where: { id: { in: params.posSessionIds } } })
        : [];
        
      // 2. Fetch FD Sessions
      const fdSessions = params.frontdeskSessionIds.length > 0
        ? await tx.frontdeskSession.findMany({ where: { id: { in: params.frontdeskSessionIds } } })
        : [];

      // 3. Validation: Ownership, Property Isolation, and Status
      let totalAmount = 0;
      let primaryOperatorId = '';
      
      for (const shift of posSessions) {
        if (shift.propertyId !== params.propertyId) throw new ShiftControlError(`Shift ${shift.id} belongs to a different property.`, 'FORBIDDEN', 403);
        if (!primaryOperatorId) primaryOperatorId = shift.openedBy;
        
        if (!['APPROVED', 'APPROVED_WITH_VARIANCE'].includes(shift.controlStatus)) {
          throw new ShiftControlError(`Shift ${shift.id} is not approved. Current status: ${shift.controlStatus}`, 'BAD_REQUEST');
        }
        if (shift.cashHandoverId) throw new ShiftControlError(`Shift ${shift.id} is already in a handover.`, 'BAD_REQUEST');
        
        // Use operator declared cash (actualCash) for custody tracking, since variance was already accepted.
        totalAmount += Number(shift.actualCash || 0);
      }

      for (const shift of fdSessions) {
        if (shift.propertyId !== params.propertyId) throw new ShiftControlError(`Shift ${shift.id} belongs to a different property.`, 'FORBIDDEN', 403);
        if (!primaryOperatorId) primaryOperatorId = shift.staffId;
        
        if (!['APPROVED', 'APPROVED_WITH_VARIANCE'].includes(shift.controlStatus)) {
          throw new ShiftControlError(`Shift ${shift.id} is not approved. Current status: ${shift.controlStatus}`, 'BAD_REQUEST');
        }
        if (shift.cashHandoverId) throw new ShiftControlError(`Shift ${shift.id} is already in a handover.`, 'BAD_REQUEST');
        
        totalAmount += Number(shift.declaredCash || 0);
      }
      
      // Ensure primaryOperatorId is a Staff ID (POS might store User ID in openedBy)
      let handedOverByStaffId = params.creatorId;
      if (primaryOperatorId) {
        const staff = await tx.staff.findFirst({ where: { OR: [{ id: primaryOperatorId }, { userId: primaryOperatorId }] } });
        if (staff) handedOverByStaffId = staff.id;
      }
      
      if (posSessions.length === 0 && fdSessions.length === 0) {
        throw new ShiftControlError('Must provide at least one shift to handover.', 'BAD_REQUEST');
      }

      // 4. Create Handover Record
      const handover = await tx.cashHandover.create({
        data: {
          id: crypto.randomUUID(),
          propertyId: params.propertyId,
          handoverReference: `HO-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          idempotencyKey: params.idempotencyKey,
          amount: totalAmount,
          handedOverById: handedOverByStaffId,
          safeReference: params.safeReference,
          notes: params.notes,
          status: 'PENDING',
        }
      });

      // 5. Link shifts and update their statuses to HANDOVER_PENDING
      if (params.posSessionIds.length > 0) {
        await tx.posSession.updateMany({
          where: { id: { in: params.posSessionIds } },
          data: { 
            cashHandoverId: handover.id,
            controlStatus: 'HANDOVER_PENDING' 
          }
        });
      }

      if (params.frontdeskSessionIds.length > 0) {
        await tx.frontdeskSession.updateMany({
          where: { id: { in: params.frontdeskSessionIds } },
          data: { 
            cashHandoverId: handover.id,
            status: 'HANDOVER_PENDING',
            controlStatus: 'HANDOVER_PENDING'
          }
        });
      }

      // 6. Audit Trail
      for (const id of params.posSessionIds) {
        await this.audit(tx, params.propertyId, params.creatorId, id, undefined, 'HANDOVER_CREATED', 'APPROVED', 'HANDOVER_PENDING', { handoverId: handover.id, amount: totalAmount });
      }
      for (const id of params.frontdeskSessionIds) {
        await this.audit(tx, params.propertyId, params.creatorId, undefined, id, 'HANDOVER_CREATED', 'APPROVED', 'HANDOVER_PENDING', { handoverId: handover.id, amount: totalAmount });
      }

      return handover;
    });
  }

  /**
   * General Cashier receives a pending handover and takes custody of the cash.
   */
  static async receiveHandover(params: {
    handoverId: string;
    receiverId: string;
    notes?: string;
  }) {
    return prisma.$transaction(async tx => {
      const handover = await tx.cashHandover.findUnique({
        where: { id: params.handoverId },
        include: {
          posSessions: { select: { id: true, controlStatus: true } },
          frontdeskSessions: { select: { id: true, status: true } }
        }
      });

      if (!handover) throw new ShiftControlError('Handover not found', 'NOT_FOUND', 404);
      if (handover.status !== 'PENDING') throw new ShiftControlError(`Handover is already ${handover.status}`, 'BAD_REQUEST');
      if (handover.handedOverById === params.receiverId) throw new ShiftControlError('Cannot receive your own handover', 'FORBIDDEN', 403);

      // Verify the receiver has property access (assumed to be done at controller level, but safe to double check)
      
      const updated = await tx.cashHandover.update({
        where: { id: params.handoverId },
        data: {
          status: 'COMPLETED',
          receivedById: params.receiverId,
          receivedAt: new Date(),
          notes: params.notes ? `${handover.notes || ''}\n[Received]: ${params.notes}` : handover.notes
        }
      });

      // Update linked shifts to HANDED_OVER
      if (handover.posSessions.length > 0) {
        const ids = handover.posSessions.map(s => s.id);
        await tx.posSession.updateMany({
          where: { id: { in: ids } },
          data: { controlStatus: 'HANDED_OVER', handoverAt: new Date() }
        });
        
        for (const session of handover.posSessions) {
          await this.audit(tx, handover.propertyId, params.receiverId, session.id, undefined, 'CASH_RECEIVED', session.controlStatus, 'HANDED_OVER', { handoverId: handover.id });
        }
      }

      if (handover.frontdeskSessions.length > 0) {
        const ids = handover.frontdeskSessions.map(s => s.id);
        await tx.frontdeskSession.updateMany({
          where: { id: { in: ids } },
          data: { status: 'HANDED_OVER', controlStatus: 'HANDED_OVER', handoverAt: new Date() }
        });
        
        for (const session of handover.frontdeskSessions) {
          await this.audit(tx, handover.propertyId, params.receiverId, undefined, session.id, 'CASH_RECEIVED', session.status, 'HANDED_OVER', { handoverId: handover.id });
        }
      }

      return updated;
    });
  }

  private static async audit(
    tx: any,
    propertyId: string,
    performedBy: string,
    posSessionId?: string,
    frontdeskSessionId?: string,
    action: string = 'HANDOVER_EVENT',
    fromStatus: string = '',
    toStatus: string = '',
    metadata: any = {}
  ) {
    await tx.shiftControlAudit.create({
      data: {
        id: crypto.randomUUID(),
        propertyId,
        posSessionId,
        frontdeskSessionId,
        action,
        fromStatus,
        toStatus,
        performedBy,
        metadata,
        idempotencyKey: `audit_${crypto.randomUUID()}`
      }
    });
  }
}
