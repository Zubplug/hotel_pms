import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { createHash } from 'crypto';
import { compare } from 'bcryptjs';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    const deviceToken = authHeader.substring(7);
    const body = await req.json();
    const { propertyId, events } = body;

    if (!propertyId || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    // Verify terminal and property
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) {
       return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const terminals = await prisma.posTerminal.findMany({
      where: { propertyId, registrationState: 'REGISTERED' }
    });

    let device = null;
    const sha256Hash = createHash('sha256').update(deviceToken).digest('hex');

    for (const t of terminals) {
      if (t.deviceCredentialHash) {
        if (t.deviceCredentialHash === sha256Hash) {
           device = t;
           break;
        }
        if (t.deviceCredentialHash.length === 60) {
           if (await compare(deviceToken, t.deviceCredentialHash)) {
             device = t;
             break;
           }
        }
      }
    }

    if (!device) {
      return NextResponse.json({ error: 'Terminal not authorized' }, { status: 403 });
    }

    const results = [];

    // Process outbox events sequentially
    for (const event of events) {
      const {
        id,
        idempotencyKey,
        aggregateType,
        aggregateId,
        aggregateVersion,
        eventType,
        occurredAt,
        sequence,
        payloadJson,
        operatorId
      } = event;
      
      try {
        const payload = JSON.parse(payloadJson || '{}');

        // 1 & 2. Atomic Concurrency Control & Execution within a Single Transaction
        await prisma.$transaction(async (tx) => {
          
          // 1. Idempotency Check (inside transaction lock)
          const existingEvent = await tx.hotelEvent.findUnique({ 
            where: { idempotencyKey },
            include: { syncConflict: true }
          });

          if (existingEvent) {
             const e = new Error('IDEMPOTENCY_DUPLICATE');
             (e as any).existingEvent = existingEvent;
             throw e;
          }

          let updatedCount = 0;
          
          if (aggregateType === 'FOLIO') {
             const res = await tx.folio.updateMany({
               where: { id: aggregateId, version: aggregateVersion },
               data: { version: { increment: 1 } }
             });
             updatedCount = res.count;
          } else if (aggregateType === 'RESERVATION') {
             if (eventType === 'CREATE') {
                updatedCount = 1; // Bypass version lock since it doesn't exist yet
             } else {
                const res = await tx.reservation.updateMany({
                  where: { id: aggregateId, version: aggregateVersion },
                  data: { version: { increment: 1 } }
                });
                updatedCount = res.count;
             }
          } else if (aggregateType === 'HOUSEKEEPING_TASK' || aggregateType === 'MAINTENANCE_TICKET' || aggregateType === 'GUEST' || aggregateType === 'ROOM') {
             updatedCount = 1; // No version field on cloud for these yet
          }

          if (updatedCount === 0) {
             // Retrieve actual version to report in the conflict
             let currentVersion = 1;
             if (aggregateType === 'FOLIO') {
                const f = await tx.folio.findUnique({ where: { id: aggregateId }});
                if (f) currentVersion = f.version;
             } else if (aggregateType === 'RESERVATION') {
                const r = await tx.reservation.findUnique({ where: { id: aggregateId }});
                if (r) currentVersion = r.version;
             }
             
             const e = new Error('CONCURRENCY_CONFLICT');
             (e as any).currentVersion = currentVersion;
             throw e;
          }

          // Authoritative Domain Routing
          if (eventType === 'CREATE' && aggregateType === 'RESERVATION') {
             const property = await tx.property.findUnique({ where: { id: propertyId } });
             let finalGuestId = payload.GuestId || payload.guestId;
             
             // If a GuestId is provided, check if it exists in the cloud DB
             if (finalGuestId) {
               const existingGuest = await tx.guest.findUnique({ where: { id: finalGuestId } });
               if (!existingGuest && payload.Guest) {
                 // C# generated a local GuestId, but it's not in the cloud yet.
                 await tx.guest.create({
                   data: {
                     id: finalGuestId,
                     organizationId: property?.organizationId || '',
                     firstName: payload.Guest.FirstName || 'Unknown',
                     lastName: payload.Guest.LastName || 'Guest',
                     email: payload.Guest.Email,
                     phone: payload.Guest.Phone
                   }
                 });
               } else if (!existingGuest) {
                  // No payload.Guest provided and it doesn't exist, we can't do much but fail
                  throw new Error(`GuestId ${finalGuestId} does not exist and no Guest details provided`);
               }
             } else if (payload.Guest) {
               // Fallback: create guest in cloud with auto-generated ID
               const g = await tx.guest.create({
                 data: {
                   organizationId: property?.organizationId || '',
                   firstName: payload.Guest.FirstName || 'Unknown',
                   lastName: payload.Guest.LastName || 'Guest',
                   email: payload.Guest.Email,
                   phone: payload.Guest.Phone
                 }
               });
               finalGuestId = g.id;
             }
             
             if (!finalGuestId) throw new Error("Missing GuestId for reservation");

             const reqRoomId = payload.RoomId || payload.roomId;
             const reqRoomTypeId = payload.RoomTypeId || payload.roomTypeId;
             
             let room = null;
             let roomType = null;

             if (reqRoomId) {
               room = await tx.room.findFirst({
                 where: { id: reqRoomId, propertyId },
                 include: { roomType: true }
               });
               if (!room) throw new Error("Room not found or unauthorized");
               roomType = room.roomType;
             } else if (reqRoomTypeId) {
               roomType = await tx.roomType.findFirst({
                 where: { id: reqRoomTypeId, propertyId }
               });
               if (!roomType) throw new Error("RoomType not found or unauthorized");
             } else {
               roomType = await tx.roomType.findFirst({ where: { propertyId, isActive: true } });
               if (!roomType) throw new Error("No room types available for property");
             }

             const checkInDate = new Date(payload.CheckInDate || payload.checkInDate || payload.checkIn);
             const checkOutDate = new Date(payload.CheckOutDate || payload.checkOutDate || payload.checkOut);
             const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
             const baseRate = Number(roomType.baseRate);
             const amount = baseRate * nights;
             const currency = roomType.currency || 'NGN';

             // Resolve property-level rate plan (required FK)
             const ratePlan = await tx.ratePlan.findFirst({ where: { propertyId, isActive: true } });
             if (!ratePlan) throw new Error('No active RatePlan found for property');

             await tx.reservation.create({
               data: {
                 id: aggregateId,
                 propertyId,
                 primaryGuestId: finalGuestId,
                 source: 'WALK_IN',
                 status: (payload.Status || payload.status || 'CONFIRMED') as any,
                 checkIn: checkInDate,
                 checkOut: checkOutDate,
                 adults: payload.Adults || payload.adults || 1,
                 children: payload.Children || payload.children || 0,
                 ratePlanId: ratePlan.id,
                 ratePlanSnapshot: { baseRate, currency, nights, total: amount },
                 confirmationNumber: `RES-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
                 currency,
                 createdBy: operatorId || device.id,
                 version: aggregateVersion,
               }
             });

             await tx.reservationRoom.create({
               data: {
                 reservationId: aggregateId,
                 roomTypeId: roomType.id,
                 roomId: room ? room.id : null,
                 checkIn: checkInDate,
                 checkOut: checkOutDate,
                 adults: payload.Adults || payload.adults || 1,
                 children: payload.Children || payload.children || 0,
                 ratePlanId: ratePlan.id,
                 rateAmount: baseRate,
                 currency,
                 status: 'ACTIVE'
               }
             });

             await tx.reservationGuest.create({
               data: {
                 reservationId: aggregateId,
                 guestId: finalGuestId,
                 isPrimary: true
               }
             });

             // 7D.1: Create Folio
             const folioNumber = 'FOL-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
             const newFolio = await tx.folio.create({
               data: {
                 reservationId: aggregateId,
                 propertyId,
                 guestId: finalGuestId,
                 folioNumber,
                 type: 'ROOM',
                 status: 'OPEN',
                 currency: currency,
                 totalCharges: amount,
                 totalPayments: 0,
                 balance: amount,
                 version: 1
               }
             });

             // 7D.1: Create Per-Night Room Charges
             const folioItems: any[] = [];
             let currentDate = new Date(checkInDate);
             for (let i = 0; i < nights; i++) {
               folioItems.push({
                 folioId: newFolio.id,
                 businessDate: new Date(currentDate),
                 type: 'CHARGE',
                 source: 'ROOM_CHARGE',
                 description: `Room Charge - Night ${i + 1}`,
                 quantity: 1,
                 unitAmount: baseRate,
                 amount: baseRate,
                 currency: currency,
                 baseAmount: baseRate,
                 postedBy: operatorId || device.id,
               });
               currentDate.setDate(currentDate.getDate() + 1);
             }
             
             await tx.folioItem.createMany({ data: folioItems });
          }
          else if (eventType === 'CHECK_IN') {
             await tx.reservation.update({
               where: { id: aggregateId },
               data: { status: 'CHECKED_IN' }
             });
             if (payload.roomId) {
               await tx.room.update({
                 where: { id: payload.roomId },
                 data: { status: 'OCCUPIED' }
               });
             }
          } 
          else if (eventType === 'CHECK_OUT') {
             await tx.reservation.update({
               where: { id: aggregateId },
               data: { status: 'CHECKED_OUT' }
             });
             if (payload.roomId) {
               await tx.room.update({
                 where: { id: payload.roomId },
                 data: { status: 'DIRTY' }
               });
             }
          }
          else if (eventType === 'ROOM_CHARGE' || eventType === 'POST_CHARGE') {
             const existingCharge = await tx.folioItem.findFirst({ where: { posTransactionId: idempotencyKey } });
             if (existingCharge) {
                const e = new Error('IDEMPOTENCY_DUPLICATE');
                throw e;
             }
             
             const amount = Number(payload.amount);
             await tx.folioItem.create({
               data: {
                 folioId: aggregateId,
                 businessDate: new Date(payload.originalBusinessDate || payload.businessDate || new Date()),
                 type: 'CHARGE',
                 source: payload.source || 'ROOM_CHARGE',
                 description: payload.description,
                 quantity: 1,
                 unitAmount: amount,
                 amount: amount,
                 currency: payload.currency || 'NGN',
                 baseAmount: amount,
                 postedBy: operatorId || device.id, // Fallback
                 deviceId: device.id,
                 isLatePosting: true,
                 posTransactionId: idempotencyKey
               }
             });

             await tx.folio.update({
               where: { id: aggregateId },
               data: { totalCharges: { increment: amount }, balance: { increment: amount } }
             });
          }
          else if (eventType === 'POST_PAYMENT') {
             // Folio-level payment — idempotent via posTransactionId uniqueness
             const amount = Number(payload.amount);
             if (!amount || amount <= 0) throw new Error('Payment amount must be positive');

             const folio = await tx.folio.findUnique({ where: { id: aggregateId, propertyId } });
             if (!folio) throw new Error('Folio not found or unauthorized');

             // Idempotency: if a FolioItem already exists with this event's idempotencyKey, skip
             const existing = await tx.folioItem.findFirst({
               where: { posTransactionId: idempotencyKey }
             });
             if (!existing) {
               await tx.folioItem.create({
                 data: {
                   folioId: aggregateId,
                   businessDate: new Date(payload.originalBusinessDate || payload.businessDate || new Date()),
                   type: 'PAYMENT',
                   source: 'MANUAL',
                   description: payload.description || `${payload.method || 'PAYMENT'} payment`,
                   quantity: 1,
                   unitAmount: -amount,
                   amount: -amount,
                   currency: payload.currency || 'NGN',
                   baseAmount: amount,
                   postedBy: operatorId || device.id,
                   deviceId: device.id,
                   isLatePosting: true,
                   posTransactionId: idempotencyKey,
                 }
               });

               await tx.folio.update({
                 where: { id: aggregateId },
                 data: {
                   totalPayments: { increment: amount },
                   balance: { decrement: amount }
                 }
               });
             }
          }
          else if (eventType === 'CANCEL') {
             // Idempotent — if already cancelled, treat as success
             const res = await tx.reservation.findUnique({
               where: { id: aggregateId, propertyId },
               include: { reservationRooms: { where: { status: 'ACTIVE' } } }
             });
             if (!res) throw new Error('Reservation not found or unauthorized');
             if (res.status === 'CHECKED_OUT') throw new Error('Cannot cancel a checked-out reservation');

             if (res.status !== 'CANCELLED') {
               await tx.reservation.update({
                 where: { id: aggregateId },
                 data: { status: 'CANCELLED' }
               });

               // Mark active reservation rooms as cancelled
               await tx.reservationRoom.updateMany({
                 where: { reservationId: aggregateId, status: 'ACTIVE' },
                 data: { status: 'CANCELLED' }
               });

               // Free the room only if it still belongs to this reservation
               if (payload.roomId) {
                 const roomStillBelongs = res.reservationRooms.some((rr: any) => rr.roomId === payload.roomId);
                 if (roomStillBelongs) {
                   // Only mark AVAILABLE if no other active reservation owns it
                   const otherActive = await tx.reservationRoom.findFirst({
                     where: { roomId: payload.roomId, status: 'ACTIVE', reservationId: { not: aggregateId } }
                   });
                   if (!otherActive) {
                     await tx.room.update({ where: { id: payload.roomId }, data: { status: 'AVAILABLE' } });
                   }
                 }
               }
             }
          }
          else if (eventType === 'REASSIGN_ROOM') {
             const { newRoomId, oldRoomId, newRoomNumber } = payload;
             if (!newRoomId) throw new Error('newRoomId is required for REASSIGN_ROOM');

             // Validate the reservation exists in this property
             const res = await tx.reservation.findUnique({
               where: { id: aggregateId, propertyId },
               include: { reservationRooms: { where: { status: 'ACTIVE' } } }
             });
             if (!res) throw new Error('Reservation not found or unauthorized');
             if (res.status === 'CHECKED_OUT' || res.status === 'CANCELLED')
               throw new Error(`Cannot reassign room for a ${res.status} reservation`);

             // Validate new room belongs to this property
             const newRoom = await tx.room.findFirst({ where: { id: newRoomId, propertyId } });
             if (!newRoom) throw new Error('New room not found or unauthorized');

             // Validate new room not already occupied by another active reservation
             const newRoomConflict = await tx.reservationRoom.findFirst({
               where: { roomId: newRoomId, status: 'ACTIVE', reservationId: { not: aggregateId } }
             });
             if (newRoomConflict) throw new Error('New room is already assigned to another active reservation');

             // Deactivate all current active room assignments for this reservation
             await tx.reservationRoom.updateMany({
               where: { reservationId: aggregateId, status: 'ACTIVE' },
               data: { status: 'INACTIVE' }
             });

             // Create new assignment
             const activeRoom = res.reservationRooms[0];
             await tx.reservationRoom.create({
               data: {
                 reservationId: aggregateId,
                 roomTypeId: newRoom.roomTypeId,
                 roomId: newRoomId,
                 checkIn: activeRoom?.checkIn || res.checkIn,
                 checkOut: activeRoom?.checkOut || res.checkOut,
                 adults: activeRoom?.adults || res.adults,
                 children: activeRoom?.children || res.children,
                 ratePlanId: activeRoom?.ratePlanId,
                 rateAmount: activeRoom?.rateAmount || 0,
                 currency: activeRoom?.currency || 'NGN',
                 status: 'ACTIVE'
               }
             });

             // Room assignment is tracked via reservationRoom; no field on reservation to update here

             // Release old room if it was this reservation's room
             if (oldRoomId && oldRoomId !== newRoomId) {
               const stillOwned = await tx.reservationRoom.findFirst({
                 where: { roomId: oldRoomId, status: 'ACTIVE', reservationId: { not: aggregateId } }
               });
               if (!stillOwned) {
                 await tx.room.update({ where: { id: oldRoomId }, data: { status: 'AVAILABLE' } });
               }
             }
             // Occupy new room
             await tx.room.update({ where: { id: newRoomId }, data: { status: 'OCCUPIED' } });
          }
          else if (eventType === 'EXTEND_STAY') {
             const newCheckOut = new Date(payload.newCheckOutDate);
             if (isNaN(newCheckOut.getTime())) throw new Error('Invalid newCheckOutDate');

             const res = await tx.reservation.findUnique({
               where: { id: aggregateId, propertyId },
               include: { reservationRooms: { where: { status: 'ACTIVE' } } }
             });
             if (!res) throw new Error('Reservation not found or unauthorized');
             if (res.status === 'CHECKED_OUT' || res.status === 'CANCELLED')
               throw new Error(`Cannot extend a ${res.status} reservation`);

             if (newCheckOut <= res.checkIn) throw new Error('New checkout must be after check-in');
             if (newCheckOut <= res.checkOut) throw new Error('New checkout must be after the current checkout date');

             // Conflict check: any other reservation in the same room during extension period
             const activeRoom = res.reservationRooms[0];
             if (activeRoom?.roomId) {
               const conflict = await tx.reservationRoom.findFirst({
                 where: {
                   roomId: activeRoom.roomId,
                   status: { notIn: ['INACTIVE', 'CANCELLED', 'NO_SHOW'] },
                   reservationId: { not: aggregateId },
                   AND: [
                     { checkIn: { lt: newCheckOut } },
                     { checkOut: { gt: res.checkOut } }
                   ]
                 }
               });
               if (conflict) throw new Error('Room is not available for the extended period');
             }

             await tx.reservation.update({
               where: { id: aggregateId },
               data: { checkOut: newCheckOut }
             });

             if (activeRoom) {
               await tx.reservationRoom.update({
                 where: { id: activeRoom.id },
                 data: { checkOut: newCheckOut }
               });
             }
          }
          else if (eventType === 'EDIT') {
             const res = await tx.reservation.findUnique({
               where: { id: aggregateId, propertyId },
               include: { reservationRooms: { orderBy: { createdAt: 'desc' }, take: 1 } }
             });
             if (!res) throw new Error('Reservation not found or unauthorized');
             if (res.status === 'CHECKED_OUT' || res.status === 'CANCELLED')
               throw new Error(`Cannot edit a ${res.status} reservation`);

             const p = payload;
             const newCheckIn  = p.checkIn  ? new Date(p.checkIn)  : res.checkIn;
             const newCheckOut = p.checkOut ? new Date(p.checkOut) : res.checkOut;

             if (newCheckOut <= newCheckIn) throw new Error('Check-out must be after check-in');

             // Availability check when dates or room changed
             const newRoomId = p.roomId || res.reservationRooms[0]?.roomId;
             if (newRoomId && (p.checkIn || p.checkOut || p.roomId)) {
               const overlap = await tx.reservationRoom.findFirst({
                 where: {
                   roomId: newRoomId,
                   reservationId: { not: aggregateId },
                   status: { notIn: ['INACTIVE', 'CANCELLED', 'NO_SHOW'] },
                   AND: [{ checkIn: { lt: newCheckOut } }, { checkOut: { gt: newCheckIn } }]
                 }
               });
               if (overlap) throw new Error('Room is not available for the new dates');
             }

             // Recalculate rate if dates or room type changed using RoomType.baseRate
             let newRateAmount: number | undefined = res.reservationRooms[0]?.rateAmount ? Number(res.reservationRooms[0].rateAmount) : undefined;
             const newRoomTypeId = p.roomTypeId || res.reservationRooms[0]?.roomTypeId;
             if (newRoomTypeId && (p.roomTypeId || p.checkIn || p.checkOut)) {
               const rt = await tx.roomType.findFirst({
                 where: { id: newRoomTypeId, propertyId }
               });
               if (rt) {
                 const nights = Math.max(1, Math.ceil(
                   (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60 * 24)
                 ));
                 newRateAmount = Number(rt.baseRate) * nights;
               }
             }

             await tx.reservation.update({
               where: { id: aggregateId },
               data: {
                 primaryGuestId:  p.guestId         ?? res.primaryGuestId,
                 checkIn:         newCheckIn,
                 checkOut:        newCheckOut,
                 adults:          p.adults           ?? res.adults,
                 children:        p.children         ?? res.children,
                 specialRequests: p.specialRequests  ?? res.specialRequests,
               }
             });

             if (res.reservationRooms[0]) {
               await tx.reservationRoom.update({
                 where: { id: res.reservationRooms[0].id },
                 data: {
                   roomId:     newRoomId,
                   roomTypeId: newRoomTypeId,
                   checkIn:    newCheckIn,
                   checkOut:   newCheckOut,
                   adults:     p.adults   ?? res.reservationRooms[0].adults,
                   children:   p.children ?? res.reservationRooms[0].children,
                   rateAmount: newRateAmount,
                 }
               });
             }
          }
          else if (eventType === 'EDIT_GUEST' && aggregateType === 'GUEST') {
             const guestId = payload.guestId;
             if (guestId) {
                await tx.guest.update({
                  where: { id: guestId },
                  data: {
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                    email: payload.email,
                    phone: payload.phone
                  }
                });
             }
          }
          else if (eventType === 'ROOM_STATUS_UPDATE' && aggregateType === 'ROOM') {
             const room = await tx.room.findUnique({ where: { id: aggregateId } });
             if (!room) throw new Error('Room not found or unauthorized');

             const newStatus = payload.newStatus;
             if (room.status !== newStatus) {
                 await tx.room.update({
                     where: { id: aggregateId },
                     data: { status: newStatus }
                 });

                 await tx.roomStatusHistory.create({
                     data: {
                         roomId: aggregateId,
                         propertyId: room.propertyId,
                         previousStatus: room.status,
                         newStatus: newStatus,
                         source: payload.source || 'OFFLINE_SYNC',
                         changedBy: operatorId || device.id
                     }
                 });
             }
          }
          else if (aggregateType === 'HOUSEKEEPING_TASK') {
             if (eventType === 'CREATE') {
                 await tx.housekeepingTask.create({
                     data: {
                         id: aggregateId,
                         propertyId,
                         roomId: payload.RoomId || payload.roomId,
                         type: payload.TaskType || payload.taskType || 'CLEANING',
                         priority: payload.Priority || payload.priority || 'NORMAL',
                         status: (payload.Status || payload.status || 'PENDING') as any,
                         businessDate: new Date(),
                         assignedTo: payload.AssignedToUserId || payload.assignedToUserId
                     }
                 });
             }
             else if (eventType === 'UPDATE_STATUS') {
                 const currentStatus = payload.Status || payload.status;
                 const updateData: any = { status: currentStatus as any };
                 if (currentStatus === 'IN_PROGRESS') {
                     updateData.startedAt = new Date();
                 } else if (currentStatus === 'COMPLETED') {
                     updateData.completedAt = new Date();
                 }
                 await tx.housekeepingTask.update({
                     where: { id: aggregateId },
                     data: updateData
                 });
             }
          }
          else if (aggregateType === 'MAINTENANCE_TICKET') {
             if (eventType === 'CREATE') {
                 // Ensure a category exists, else use a default or fail gracefully
                 let cat = await tx.maintenanceCategory.findFirst({ where: { propertyId } });
                 if (!cat) {
                     cat = await tx.maintenanceCategory.create({
                         data: { propertyId, name: 'General', description: 'General Maintenance' }
                     });
                 }
                 await tx.maintenanceTicket.create({
                     data: {
                         id: aggregateId,
                         propertyId,
                         roomId: payload.RoomId || payload.roomId,
                         categoryId: cat.id,
                         priority: (payload.Priority || payload.priority || 'NORMAL') as any,
                         status: (payload.Status || payload.status || 'OPEN') as any,
                         title: 'Desktop Maintenance Ticket',
                         description: payload.IssueDescription || payload.issueDescription || '',
                         reportedBy: payload.ReportedBy || payload.reportedBy || operatorId || (await tx.staff.findFirst({ where: { organization: { properties: { some: { id: propertyId } } } } }))?.id
                     }
                 });
             }
             else if (eventType === 'RESOLVE') {
                 await tx.maintenanceTicket.update({
                     where: { id: aggregateId },
                     data: { status: 'RESOLVED' }
                 });
             }
          }
          else {
            throw new Error(`Unknown eventType: ${eventType}`);
          }

          // 3. Save Immutable HotelEvent (Subject to unique constraint on aggregateVersion)
          await tx.hotelEvent.create({
            data: {
              id,
              idempotencyKey,
              propertyId,
              deviceId: device.id,
              operatorId,
              aggregateType,
              aggregateId,
              aggregateVersion,
              eventType,
              occurredAt: new Date(occurredAt || Date.now()),
              sequence,
              payload
            }
          });
        });
        
        results.push({ id, status: 'SYNCED', idempotencyKey });
        
        // Post-transaction notifications for mobile hub parity
        if (aggregateType === 'RESERVATION') {
           try {
             let notificationType = null;
             if (eventType === 'CREATE' || eventType === 'WALK_IN') notificationType = 'NEW_RESERVATION';
             else if (eventType === 'CHECK_IN') notificationType = 'CHECK_IN';
             else if (eventType === 'CHECK_OUT') notificationType = 'CHECK_OUT';
             else if (eventType === 'CANCEL') notificationType = 'CANCEL';
             
             if (notificationType && property.organizationId) {
               await NotificationEngine.emit({
                 type: notificationType,
                 organizationId: property.organizationId,
                 propertyId: property.id,
                 entityType: 'reservation',
                 entityId: aggregateId,
                 idempotencyKey: `sync_${notificationType}_${aggregateId}_${Date.now()}`
               });
             }
           } catch (notifErr) {
             console.error(`[Push Sync] Failed to emit notification for ${eventType}:`, notifErr);
           }
        } else if (aggregateType === 'FOLIO' && eventType === 'POST_PAYMENT') {
           try {
             if (property.organizationId) {
               const amount = Number(payload.amount);
               await NotificationEngine.emit({
                 type: 'PAYMENT_RECEIVED',
                 organizationId: property.organizationId,
                 propertyId: property.id,
                 entityType: 'folio',
                 entityId: aggregateId,
                 metadata: {
                   amount: amount > 0 ? amount : -amount,
                   currency: payload.currency || 'NGN',
                 },
                 idempotencyKey: `sync_PAYMENT_${aggregateId}_${Date.now()}`
               });
             }
           } catch (notifErr) {
             console.error(`[Push Sync] Failed to emit notification for POST_PAYMENT:`, notifErr);
           }
        }
        
      } catch (err: any) {
        if (err.message === 'IDEMPOTENCY_DUPLICATE') {
           if (err.existingEvent.syncConflict) {
             results.push({ id, status: 'CONFLICT', idempotencyKey, error: 'Already flagged as conflict.' });
           } else {
             results.push({ id, status: 'SYNCED', idempotencyKey });
           }
        } else if (err.message === 'CONCURRENCY_CONFLICT' || err.code === 'P2002') {
           // If P2002, it means another thread inserted the same aggregateVersion for this aggregate.
           let expectedVersion = err.currentVersion || aggregateVersion;
           
           if (err.code === 'P2002') {
               // Fetch the true actual version from DB to populate the conflict correctly
               try {
                   if (aggregateType === 'FOLIO') {
                       const f = await prisma.folio.findUnique({ where: { id: aggregateId }});
                       if (f) expectedVersion = f.version;
                   } else if (aggregateType === 'RESERVATION') {
                       const r = await prisma.reservation.findUnique({ where: { id: aggregateId }});
                       if (r) expectedVersion = r.version;
                   }
               } catch (e) {}
           }
           // We must record the HotelEvent and SyncConflict outside the failed business transaction
           try {
             await prisma.$transaction(async (tx2) => {
                const ev = await tx2.hotelEvent.create({
                  data: {
                    id,
                    idempotencyKey,
                    propertyId,
                    deviceId: device.id,
                    operatorId,
                    aggregateType,
                    aggregateId,
                    aggregateVersion,
                    eventType,
                    occurredAt: new Date(occurredAt || Date.now()),
                    sequence,
                    payload: JSON.parse(payloadJson || '{}')
                  }
                });
                
                await tx2.syncConflict.create({
                  data: {
                    propertyId,
                    hotelEventId: ev.id,
                    aggregateType,
                    aggregateId,
                    expectedVersion: expectedVersion,
                    receivedVersion: aggregateVersion,
                    conflictReason: 'Optimistic Concurrency Failure: Edge node operated on stale state.',
                    status: 'PENDING'
                  }
                });
             });
             results.push({ id, status: 'CONFLICT', idempotencyKey, error: 'Concurrency conflict. Manager resolution required.' });
           } catch (conflictErr: any) {
             console.error(`Error saving conflict for event ${id}:`, conflictErr);
             results.push({ id, status: 'FAILED', idempotencyKey, error: 'Failed to record conflict state.' });
           }
        } else {
           console.error(`Error processing event ${id}:`, err);
           results.push({ id, status: 'FAILED', idempotencyKey, error: err.message });
        }
      }
    }

    return NextResponse.json({ 
      status: 'SUCCESS',
      results
    }, { status: 200 });

  } catch (error: any) {
    console.error('FrontDesk Sync Push Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
