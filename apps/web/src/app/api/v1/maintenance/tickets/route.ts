import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);

    await assertPropertyAccess(session.user.id, propertyId);

    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const where: any = { propertyId };
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const tickets = await prisma.maintenanceTicket.findMany({
      where,
      include: {
        category: true,
        property: {
          include: {
            rooms: {
              where: {
                id: {
                  in: await prisma.maintenanceTicket.findMany({ where }).then(res => res.map(t => t.roomId).filter(Boolean) as string[])
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse({ tickets });
  } catch (err: any) {
    console.error('[Maintenance Tickets GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    let { propertyId, roomId, categoryId, priority, title, description, location, photos } = body;

    if (!propertyId || !priority || !title || !description) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    await assertPropertyAccess(session.user.id, propertyId);
    
    // In production, require permission check
    const canCreate = await hasPermission(session.user.id, 'housekeeping', 'create', propertyId); // fallback permission check
    if (!canCreate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    if (!categoryId) {
      const generalCat = await prisma.maintenanceCategory.findFirst({ where: { propertyId, name: 'General' } });
      if (generalCat) {
        categoryId = generalCat.id;
      } else {
        const newCat = await prisma.maintenanceCategory.create({ data: { propertyId, name: 'General' } });
        categoryId = newCat.id;
      }
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const newTicket = await tx.maintenanceTicket.create({
        data: {
          propertyId,
          roomId,
          categoryId,
          location,
          priority,
          status: 'OPEN',
          title,
          description,
          photos: photos || [],
          reportedBy: session.user.id,
        }
      });

      // Write Creation log
      await tx.auditLog.create({
        data: {
          organizationId: property.organizationId,
          propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'MAINTENANCE_TICKET_CREATED',
          resource: 'MaintenanceTicket',
          resourceId: newTicket.id,
          newValue: { roomId, priority, categoryId },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: crypto.randomUUID(),
        }
      });

      // Handle CRITICAL issue logic automatically putting room OUT_OF_ORDER
      if (priority === 'CRITICAL' && roomId) {
        const room = await tx.room.findUnique({ where: { id: roomId } });
        if (room && room.status !== 'OUT_OF_ORDER') {
          const oldStatus = room.status;
          await tx.room.update({
            where: { id: roomId },
            data: { status: 'OUT_OF_ORDER' }
          });

          await tx.auditLog.create({
            data: {
              organizationId: property.organizationId,
              propertyId,
              userId: session.user.id,
              userEmail: session.user.email,
              userRole: (session.user as any).role || 'STAFF',
              action: 'ROOM_STATUS_CHANGED',
              resource: 'Room',
              resourceId: room.id,
              previousValue: { status: oldStatus },
              newValue: { status: 'OUT_OF_ORDER', reason: 'CRITICAL_MAINTENANCE' },
              ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
              userAgent: req.headers.get('user-agent') || 'Unknown',
              requestId: crypto.randomUUID(),
            }
          });

          // Booking protection logic: notify if future reservations exist for this room
          const futureReservations = await tx.reservationRoom.findMany({
            where: {
              roomId: room.id,
              reservation: { status: 'CONFIRMED' }
            },
            include: { reservation: true }
          });

          if (futureReservations.length > 0) {
            // For Phase 8C, we generate an internal "Notification" to prompt Front Desk
            // Wait, we don't have an Alert model, we found a Notification model!
            const adminUsers = await tx.staff.findMany({
              where: { organizationId: property.organizationId, department: 'Management' }
            });
            
            for (const admin of adminUsers) {
              await tx.notification.create({
                data: {
                  organizationId: property.organizationId,
                  propertyId: property.id,
                  recipientType: 'staff',
                  recipientId: admin.id, // Notification expects Staff ID or User ID? recipientId is String @db.Uuid. Let's use Staff.id since type is 'staff'
                  channel: 'in_app',
                  subject: `Room ${room.number} is OUT OF ORDER with upcoming bookings`,
                  body: `Room ${room.number} has been placed Out of Order due to a critical maintenance issue, but has upcoming confirmed reservations. Please reassign the reservations.`,
                  status: 'pending',
                }
              });
            }
          }
        }
      }

      return newTicket;
    });

    return successResponse({ message: 'Maintenance Ticket created successfully', ticket }, 201);
  } catch (err: any) {
    console.error('[Maintenance Tickets POST]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
