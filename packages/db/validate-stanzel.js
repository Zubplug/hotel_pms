const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30"
    }
  }
});

async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  console.log(`Checking property ${propertyId} (Stanzel Grand Resort)...`);

  // 1. Check for Active Reservations referencing Inactive Rooms
  const resRooms = await prisma.reservationRoom.findMany({
    where: { reservation: { propertyId: propertyId }, status: 'ACTIVE' },
    include: { room: true, reservation: true }
  });
  for (const rr of resRooms) {
    if (rr.room && !rr.room.isActive) console.log(`❌ Reservation ${rr.reservation.id} has ACTIVE ReservationRoom for INACTIVE Room ${rr.room.id}`);
  }

  // 2. Check for Orders referencing Inactive Products
  const orderItems = await prisma.posOrderItem.findMany({
    where: { order: { propertyId: propertyId } },
    include: { product: true, order: true }
  });
  for (const oi of orderItems) {
    if (oi.product && !oi.product.isActive) console.log(`❌ PosOrder ${oi.order.id} has item for INACTIVE Product ${oi.product.id}`);
  }

  // 3. Check if any roomType is inactive but has active rooms
  const rooms = await prisma.room.findMany({
    where: { propertyId: propertyId, isActive: true },
    include: { roomType: true }
  });
  for (const r of rooms) {
    if (r.roomType && !r.roomType.isActive) console.log(`❌ Active Room ${r.id} uses INACTIVE RoomType ${r.roomType.id}`);
  }

  // 4. Staff FK checks (PosOrder, HousekeepingTask, MaintenanceTicket, LockCredential)
  const posOrders = await prisma.posOrder.findMany({ where: { propertyId } });
  const activeStaff = await prisma.staff.findMany({ where: { propertyAccess: { has: propertyId }, isActive: true, deletedAt: null } });
  const activeStaffIds = new Set(activeStaff.map(s => s.id));
  
  for (const o of posOrders) {
    if (o.openedById && !activeStaffIds.has(o.openedById)) console.log(`❌ PosOrder ${o.id} references INACTIVE/MISSING Staff openedBy: ${o.openedById}`);
    if (o.closedById && !activeStaffIds.has(o.closedById)) console.log(`❌ PosOrder ${o.id} references INACTIVE/MISSING Staff closedBy: ${o.closedById}`);
  }

  const hkTasks = await prisma.housekeepingTask.findMany({ where: { propertyId } });
  for (const t of hkTasks) {
    if (t.assignedToId && !activeStaffIds.has(t.assignedToId)) console.log(`❌ HousekeepingTask ${t.id} references INACTIVE/MISSING Staff: ${t.assignedToId}`);
  }
  
  const mtTickets = await prisma.maintenanceTicket.findMany({ where: { propertyId } });
  for (const t of mtTickets) {
    if (t.assignedToId && !activeStaffIds.has(t.assignedToId)) console.log(`❌ MaintenanceTicket ${t.id} references INACTIVE/MISSING Staff: ${t.assignedToId}`);
  }

  const credentials = await prisma.lockCredential.findMany({ where: { reservation: { propertyId } }, include: { reservation: true } });
  for (const c of credentials) {
    if (c.issuedById && !activeStaffIds.has(c.issuedById)) console.log(`❌ LockCredential ${c.id} on Reservation ${c.reservation.id} references INACTIVE/MISSING Staff: ${c.issuedById}`);
  }

  // 5. PosSession mismatches (PosOrder references a PosSession that might not be synced)
  const now = new Date();
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const syncedSessions = await prisma.posSession.findMany({
    where: {
      outlet: { propertyId },
      OR: [{ status: 'OPEN' }, { status: 'RECONCILIATION_REQUIRED' }, { closedAt: { gte: twoDaysAgo } }]
    }
  });
  const syncedSessionIds = new Set(syncedSessions.map(s => s.id));

  const syncedOrders = await prisma.posOrder.findMany({
    where: { propertyId, OR: [{ status: { in: ['SUBMITTED', 'IN_SERVICE'] } }, { closedAt: { gte: twoDaysAgo } }] }
  });

  for (const o of syncedOrders) {
    if (o.sessionId && !syncedSessionIds.has(o.sessionId)) console.log(`❌ PosOrder ${o.id} references PosSession ${o.sessionId} which is NOT SYNCED!`);
  }
  
  // 6. Reservation missing dependencies: RatePlan, CorporateAccount
  const activeRatePlans = await prisma.ratePlan.findMany({ where: { propertyId, isActive: true } });
  const activeRatePlanIds = new Set(activeRatePlans.map(r => r.id));
  
  const reservations = await prisma.reservation.findMany({ 
    where: { propertyId, deletedAt: null, OR: [ { status: 'CHECKED_IN' }, { status: 'CONFIRMED' }, { checkOut: { gte: twoDaysAgo } } ] } 
  });
  for (const r of reservations) {
    if (r.ratePlanId && !activeRatePlanIds.has(r.ratePlanId)) console.log(`❌ Reservation ${r.id} references INACTIVE RatePlan: ${r.ratePlanId}`);
  }

  console.log("Done checking Stanzel property!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
