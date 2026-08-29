import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';
import { ShiftControlService, ShiftControlError } from '@/lib/services/shift-control-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const actorUserId = actor.user.id;
    const role = String((actor.user as any).role || '').toUpperCase();
    
    const { shiftId } = await params;
    const { decision, notes, reasonCode } = await req.json();
    
    const reviewNotes = typeof notes === 'string' ? notes.trim() : '';

    const userRec = await prisma.user.findUnique({ where: { id: actorUserId }, select: { staffId: true } });
    const staff = await prisma.staff.findFirst({ 
      where: { 
        OR: [
          { userId: actorUserId },
          ...(userRec?.staffId ? [{ id: userRec.staffId }] : [])
        ]
      }, 
      select: { id: true } 
    });

    if (!staff) return errorResponse('UNAUTHORIZED', 'Reviewer staff record not found', 401);
    const reviewerId = staff.id;

    // Determine shift type and verify property access
    let type: 'POS' | 'FRONT_DESK';
    let propertyId: string;
    
    const frontdesk = await prisma.frontdeskSession.findUnique({ where: { id: shiftId }, select: { propertyId: true } });
    if (frontdesk) {
      type = 'FRONT_DESK';
      propertyId = frontdesk.propertyId;
    } else {
      const pos = await prisma.posSession.findUnique({ where: { id: shiftId }, select: { propertyId: true } });
      if (!pos || !pos.propertyId) return errorResponse('NOT_FOUND', 'Shift not found', 404);
      type = 'POS';
      propertyId = pos.propertyId;
    }

    if (!(await getUserPropertyIds(actorUserId)).includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    let updated;
    if (decision === 'APPROVED') {
      updated = await ShiftControlService.approveShift(type, shiftId, reviewerId);
    } else if (decision === 'APPROVED_WITH_VARIANCE') {
      updated = await ShiftControlService.approveShiftWithVariance(type, shiftId, reviewerId, role, reasonCode, reviewNotes);
    } else if (decision === 'REJECTED') {
      updated = await ShiftControlService.returnShift(type, shiftId, reviewerId, reviewNotes);
    } else {
      return errorResponse('BAD_REQUEST', 'Invalid approval decision', 400);
    }

    if (decision === 'APPROVED' || decision === 'APPROVED_WITH_VARIANCE') {
      try {
        const { CashHandoverService } = await import('@/lib/services/cash-handover-service');
        const posSessionIds = type === 'POS' ? [shiftId] : [];
        const frontdeskSessionIds = type === 'FRONT_DESK' ? [shiftId] : [];
        
        await CashHandoverService.createHandover({
          propertyId,
          creatorId: reviewerId,
          posSessionIds,
          frontdeskSessionIds,
          notes: 'Automatically created upon shift approval.',
        });

        // Re-fetch updated shift since its controlStatus is now HANDOVER_PENDING
        if (type === 'POS') {
          updated = await prisma.posSession.findUnique({ where: { id: shiftId } });
        } else {
          updated = await prisma.frontdeskSession.findUnique({ where: { id: shiftId } });
        }
      } catch (handoverError) {
        console.error('[Shift approval] Failed to auto-create handover:', handoverError);
      }
    }

    return successResponse({ type, shift: updated });
  } catch (error: any) {
    console.error('[Shift approval POST]', error);
    if (error.name === 'ShiftControlError') {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse('INTERNAL_ERROR', 'Unable to approve shift', 500);
  }
}
