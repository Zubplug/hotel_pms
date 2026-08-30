import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import crypto from 'crypto';


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reservation = await prisma.reservation.findUnique({ where: { id }, select: { propertyId: true, status: true, id: true, property: { select: { organizationId: true } } } });
    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    await assertPropertyAccess(session.user.id, reservation.propertyId);
    
    if (await isNightAuditTransactionLocked(reservation.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Late arrival cannot be set while Night Audit is posting.', 409);
    }
    
    if (reservation.status !== 'CONFIRMED') return errorResponse('BAD_REQUEST', 'Late arrival can only be set on confirmed reservations.', 400);
    
    const notes = String(body.notes || '').trim() || null;
    const updated = await prisma.$transaction(async tx => {
      const updatedRes = await tx.reservation.update({ 
        where: { id }, 
        data: { 
          lateArrivalExpected: true, 
          lateArrivalNotes: notes, 
          lateArrivalAt: new Date()
        } 
      });

      await tx.auditLog.create({
        data: {
          organizationId: reservation.property.organizationId,
          propertyId: reservation.propertyId,
          userId: session.user.id,
          userEmail: session.user.email || 'unknown',
          userRole: String((session.user as any).role || 'STAFF'),
          action: 'RESERVATION_LATE_ARRIVAL_FLAGGED',
          resource: 'Reservation',
          resourceId: reservation.id,
          newValue: { lateArrivalExpected: true, notes },
          requestId: crypto.randomUUID(),
        }
      });
      return updatedRes;
    });
    
    return successResponse(updated);
  } catch (error) {
    console.error('[Reservation Late Arrival POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to record late arrival', 500);
  }
}
