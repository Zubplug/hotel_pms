import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import crypto from 'crypto';

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await props.params;
    const body = await req.json();
    const { status, assignedTo, actualCost, notes } = body;

    const ticket = await prisma.maintenanceTicket.findUnique({
      where: { id },
      include: { property: true }
    });

    if (!ticket) return errorResponse('NOT_FOUND', 'Maintenance ticket not found', 404);
    await assertPropertyAccess(session.user.id, ticket.propertyId);

    // Validate Transitions
    const allowedTransitions: Record<string, string[]> = {
      'OPEN': ['ASSIGNED', 'CANCELLED'],
      'ASSIGNED': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['WAITING_PARTS', 'RESOLVED', 'CANCELLED'],
      'WAITING_PARTS': ['IN_PROGRESS', 'CANCELLED'],
    };

    if (status && status !== ticket.status) {
      const allowed = allowedTransitions[ticket.status] || [];
      if (!allowed.includes(status)) {
        return errorResponse('BAD_REQUEST', `Invalid status transition from ${ticket.status} to ${status}`, 400);
      }
    }

    const updatedTicket = await prisma.$transaction(async (tx: any) => {
      const data: any = {
        status: status || ticket.status,
      };

      if (assignedTo) data.assignedTo = assignedTo;
      if (actualCost) data.actualCost = actualCost;
      if (notes) data.notes = notes;

      if (status === 'IN_PROGRESS' && ticket.status !== 'IN_PROGRESS') {
        data.startedAt = new Date();
      } else if (status === 'RESOLVED') {
        data.resolvedAt = new Date();
      } else if (status === 'CANCELLED' || status === 'CLOSED') {
        data.closedAt = new Date();
      }

      const res = await tx.maintenanceTicket.update({
        where: { id },
        data
      });

      // Audit Log for Ticket Update
      await tx.auditLog.create({
        data: {
          organizationId: ticket.property.organizationId,
          propertyId: ticket.propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: status === 'RESOLVED' ? 'MAINTENANCE_RESOLVED' : (status && status !== ticket.status ? `MAINTENANCE_${status}` : 'MAINTENANCE_TICKET_UPDATED'),
          resource: 'MaintenanceTicket',
          resourceId: ticket.id,
          previousValue: { status: ticket.status },
          newValue: data,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: crypto.randomUUID(),
        }
      });

      // If resolving a ticket that put the room out of order, transition to DIRTY / PENDING
      if (status === 'RESOLVED' && ticket.roomId) {
        const room = await tx.room.findUnique({ where: { id: ticket.roomId } });
        // A resolved maintenance issue still requires housekeeping clearance.
        if (room && ['OUT_OF_ORDER', 'MAINTENANCE'].includes(room.status)) {
          const otherActiveTickets = await tx.maintenanceTicket.count({
            where: {
              roomId: room.id,
              status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS'] },
              id: { not: ticket.id }
            }
          });

          if (otherActiveTickets === 0) {
            await tx.room.update({
              where: { id: room.id },
              data: {
                status: 'DIRTY',
                housekeepingStatus: 'PENDING' // Requires inspection/cleaning before available
              }
            });

            await tx.housekeepingTask.upsert({
              where: { idempotencyKey: `MAINTENANCE_${ticket.id}` },
              update: { status: 'PENDING' },
              create: {
                idempotencyKey: `MAINTENANCE_${ticket.id}`,
                propertyId: ticket.propertyId,
                roomId: room.id,
                type: 'INSPECTION',
                priority: 'HIGH',
                status: 'PENDING',
                businessDate: new Date(new Date().setUTCHours(0, 0, 0, 0)),
                notes: 'Maintenance resolved; housekeeping must clean and inspect the room before release.'
              }
            });

            await tx.auditLog.create({
              data: {
                organizationId: ticket.property.organizationId,
                propertyId: ticket.propertyId,
                userId: session.user.id,
                userEmail: session.user.email,
                userRole: (session.user as any).role || 'STAFF',
                action: 'ROOM_STATUS_CHANGED',
                resource: 'Room',
                resourceId: room.id,
                previousValue: { status: 'OUT_OF_ORDER' },
                newValue: { status: 'DIRTY', reason: 'MAINTENANCE_RESOLVED_INSPECTION_REQUIRED' },
                ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
                userAgent: req.headers.get('user-agent') || 'Unknown',
                requestId: crypto.randomUUID(),
              }
            });
          }
        }
      }

      return res;
    });

    return successResponse({ message: 'Ticket updated successfully', ticket: updatedTicket });
  } catch (err: any) {
    console.error('[Maintenance Ticket PATCH]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
