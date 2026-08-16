import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // Optional: allow passing a specific propertyId to force audit
    const body = await request.text();
    const parsed = body ? JSON.parse(body) : {};
    const targetPropertyId = parsed.propertyId;

    // Fetch properties to audit
    const properties = targetPropertyId 
      ? await prisma.property.findMany({ where: { id: targetPropertyId, isActive: true } })
      : await prisma.property.findMany({ where: { isActive: true } });

    const results = [];

    for (const property of properties) {
      if (!property.businessDate) continue;

      const businessDate = new Date(property.businessDate);
      businessDate.setUTCHours(0,0,0,0);

      // Check if audit for this date is already complete or in progress (Idempotency lock)
      const existingAudit = await prisma.nightAudit.findUnique({
        where: {
          propertyId_businessDate: {
            propertyId: property.id,
            businessDate: businessDate
          }
        }
      });

      if (existingAudit && existingAudit.status === 'COMPLETED') {
        results.push({ propertyId: property.id, status: 'ALREADY_COMPLETED' });
        continue;
      }
      
      if (existingAudit && existingAudit.status === 'IN_PROGRESS') {
        results.push({ propertyId: property.id, status: 'ALREADY_IN_PROGRESS' });
        continue;
      }

      // Step 1: Acquire lock / Create NightAuditRun
      const auditRun = await prisma.nightAudit.upsert({
        where: {
          propertyId_businessDate: {
            propertyId: property.id,
            businessDate: businessDate
          }
        },
        create: {
          propertyId: property.id,
          businessDate: businessDate,
          status: 'IN_PROGRESS',
          startedAt: new Date()
        },
        update: {
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      });

      try {
        let totalRoomRevenue = 0;
        let chargesPosted = 0;

        // Execute Audit in a Transaction
        await prisma.$transaction(async (tx) => {
          // Step 2: Post eligible room charges
          // Find all CHECKED_IN reservations
          const activeReservations = await tx.reservation.findMany({
            where: { propertyId: property.id, status: 'CHECKED_IN' },
            include: { reservationRooms: true, folios: true }
          });

          for (const res of activeReservations) {
            // Find the main folio
            let mainFolio = res.folios.find(f => f.type === 'ROOM');
            if (!mainFolio) {
              mainFolio = await tx.folio.create({
                data: {
                  reservationId: res.id,
                  propertyId: property.id,
                  guestId: res.primaryGuestId,
                  folioNumber: `FOL-${Date.now()}-${res.id.substring(0, 4)}`,
                  type: 'ROOM',
                  status: 'OPEN',
                  currency: res.currency
                }
              });
            }

            // Post room charge for each assigned room
            for (const resRoom of res.reservationRooms) {
              if (resRoom.status !== 'CANCELLED' && resRoom.status !== 'NO_SHOW') {
                const amount = resRoom.rateAmount;
                totalRoomRevenue += Number(amount);
                chargesPosted++;

                const charge = await tx.folioItem.create({
                  data: {
                    folioId: mainFolio.id,
                    businessDate: businessDate,
                    type: 'CHARGE',
                    source: 'ROOM_CHARGE',
                    description: `Room Charge - ${businessDate.toISOString().split('T')[0]}`,
                    unitAmount: amount,
                    amount: amount,
                    baseAmount: amount,
                    currency: resRoom.currency,
                    postedBy: 'SYSTEM', // System user
                  }
                });

                await tx.folio.update({
                  where: { id: mainFolio.id },
                  data: { totalCharges: { increment: amount } }
                });
              }
            }
          }

          // Step 3: Process No-Shows
          const noShows = await tx.reservation.findMany({
            where: {
              propertyId: property.id,
              status: 'CONFIRMED',
              checkIn: { lte: businessDate }
            }
          });

          for (const ns of noShows) {
            await tx.reservation.update({
              where: { id: ns.id },
              data: {
                status: 'NO_SHOW',
                noShowAt: new Date(),
                noShowBy: 'SYSTEM'
              }
            });
            // Ideally, apply no-show penalty rules here
          }

          // Step 4: Generate OccupancySnapshot
          const totalRooms = await tx.room.count({ where: { propertyId: property.id, isActive: true } });
          const outOfOrderRooms = await tx.room.count({ where: { propertyId: property.id, status: 'OUT_OF_ORDER' } });
          const occupiedRooms = activeReservations.reduce((acc, r) => acc + r.reservationRooms.length, 0);
          const availableRooms = totalRooms - outOfOrderRooms - occupiedRooms;
          const occupancyPct = totalRooms > 0 ? (occupiedRooms / (totalRooms - outOfOrderRooms)) * 100 : 0;
          const adr = occupiedRooms > 0 ? totalRoomRevenue / occupiedRooms : 0;

          await tx.occupancySnapshot.create({
            data: {
              propertyId: property.id,
              businessDate: businessDate,
              totalRooms,
              occupiedRooms,
              availableRooms,
              outOfOrderRooms,
              blockedRooms: 0,
              occupancyPct,
              adr,
              revpar: adr * (occupancyPct / 100),
              currency: property.baseCurrency
            }
          });

          // Step 5: Advance Property.businessDate
          const nextBusinessDate = new Date(businessDate);
          nextBusinessDate.setUTCDate(nextBusinessDate.getUTCDate() + 1);

          await tx.property.update({
            where: { id: property.id },
            data: { businessDate: nextBusinessDate }
          });
        });

        // Step 6: Finalize NightAuditRun
        await prisma.nightAudit.update({
          where: { id: auditRun.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            roomChargesPosted: chargesPosted,
            totalRoomRevenue: totalRoomRevenue,
            totalRevenue: totalRoomRevenue // simplistic for now
          }
        });

        results.push({ propertyId: property.id, status: 'COMPLETED' });

      } catch (err: any) {
        // Rollback caught automatically by prisma.$transaction
        console.error(`Night Audit failed for Property ${property.id}:`, err);
        
        await prisma.nightAudit.update({
          where: { id: auditRun.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            exceptions: { error: err.message }
          }
        });

        results.push({ propertyId: property.id, status: 'FAILED', error: err.message });
      }
    }

    return NextResponse.json({ results }, { status: 200 });

  } catch (error: any) {
    console.error('Night Audit Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
