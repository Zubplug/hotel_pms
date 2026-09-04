const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30" }
  }
});

async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  const watermark = new Date();
  
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  
  const buildWhere = (base) => ({ ...base, updatedAt: { lte: watermark } });
  
  const staff = await prisma.staff.findMany({
    where: buildWhere({ propertyAccess: { has: propertyId }, isActive: true, deletedAt: null }),
  });
  const rooms = await prisma.room.findMany({ where: buildWhere({ propertyId, isActive: true }) });
  const roomTypes = await prisma.roomType.findMany({ where: buildWhere({ propertyId, isActive: true }) });
  const corporateAccounts = await prisma.corporateAccount.findMany({ where: buildWhere({ propertyId }) });
  const ratePlans = await prisma.ratePlan.findMany({ where: buildWhere({ propertyId, isActive: true }) });
  const rates = await prisma.rate.findMany({ where: buildWhere({ propertyId }) });

  const twoDaysAgo = new Date(watermark.getTime() - 2 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysFromNow = new Date(now); threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const resBaseWhere = {
    propertyId, deletedAt: null,
    OR: [
      { status: 'CHECKED_IN' },
      { status: 'CONFIRMED', checkIn: { lte: threeDaysFromNow, gte: yesterday } },
      { checkOut: { gte: yesterday, lte: threeDaysFromNow } }
    ]
  };
  
  const reservations = await prisma.reservation.findMany({
    where: buildWhere(resBaseWhere),
    include: {
      primaryGuest: true,
      reservationGuests: { include: { guest: true } },
      reservationRooms: { where: { status: 'ACTIVE' }, include: { room: true } },
      folios: { include: { items: true, payments: true, credits: true } },
      lockCredentials: true,
      lockOperations: true
    }
  });

  const posOutlets = await prisma.posOutlet.findMany({ where: buildWhere({ propertyId, isActive: true }) });
  const outletIds = posOutlets.map(o => o.id);
  const posProducts = await prisma.posProduct.findMany({
    where: buildWhere({ propertyId, isActive: true }),
    include: { modifiers: true, stockItems: { where: { isActive: true } } }
  });
  const posFloorPlans = await prisma.posFloorPlan.findMany({
    where: { outletId: { in: outletIds }, isActive: true, updatedAt: { lte: watermark } }
  });
  const posTables = await prisma.posTable.findMany({
    where: { floorPlanId: { in: posFloorPlans.map(f => f.id) }, isActive: true, updatedAt: { lte: watermark } }
  });

  const posSessions = await prisma.posSession.findMany({
    where: { outletId: { in: outletIds }, updatedAt: { lte: watermark }, OR: [{ status: 'OPEN' }, { status: 'RECONCILIATION_REQUIRED' }, { closedAt: { gte: twoDaysAgo } }] }
  });

  const posOrders = await prisma.posOrder.findMany({
    where: { propertyId, updatedAt: { lte: watermark }, OR: [{ status: { in: ['SUBMITTED', 'IN_SERVICE'] } }, { closedAt: { gte: twoDaysAgo } }] },
    include: { items: { include: { modifiers: true } }, checks: true, kots: { include: { items: true } }, payments: true }
  });

  const housekeepingTasks = await prisma.housekeepingTask.findMany({ where: buildWhere({ propertyId }) });
  const maintenanceTickets = await prisma.maintenanceTicket.findMany({ where: buildWhere({ propertyId }) });
  const laundryItems = await prisma.laundryItem.findMany({ where: buildWhere({ propertyId }) });
  const laundryOrders = await prisma.laundryOrder.findMany({ where: buildWhere({ propertyId }), include: { items: true, statusHistory: true } });

  // -------------------------
  // NOW WE VALIDATE LOCALLY
  // -------------------------
  const staffIds = new Set(staff.map(s => s.id));
  const roomIds = new Set(rooms.map(r => r.id));
  const roomTypeIds = new Set(roomTypes.map(r => r.id));
  const corpAccountIds = new Set(corporateAccounts.map(c => c.id));
  const ratePlanIds = new Set(ratePlans.map(r => r.id));
  const rateIds = new Set(rates.map(r => r.id));
  const resIds = new Set(reservations.map(r => r.id));
  const outletIdsSet = new Set(posOutlets.map(o => o.id));
  const productIds = new Set(posProducts.map(p => p.id));
  const tableIds = new Set(posTables.map(t => t.id));
  const sessionIds = new Set(posSessions.map(s => s.id));
  const orderIds = new Set(posOrders.map(o => o.id));

  let errors = 0;
  const error = (msg) => { console.log("🚨 ERROR:", msg); errors++; };

  for (const r of rooms) {
    if (r.roomTypeId && !roomTypeIds.has(r.roomTypeId)) error(`Room ${r.id} -> missing RoomType ${r.roomTypeId}`);
  }
  for (const r of rates) {
    if (r.ratePlanId && !ratePlanIds.has(r.ratePlanId)) error(`Rate ${r.id} -> missing RatePlan ${r.ratePlanId}`);
  }
  for (const res of reservations) {
    if (res.corporateAccountId && !corpAccountIds.has(res.corporateAccountId)) error(`Reservation ${res.id} -> missing CorporateAccount ${res.corporateAccountId}`);
    if (res.ratePlanId && !ratePlanIds.has(res.ratePlanId)) error(`Reservation ${res.id} -> missing RatePlan ${res.ratePlanId}`);
    
    for (const rr of res.reservationRooms) {
      if (rr.roomId && !roomIds.has(rr.roomId)) error(`ReservationRoom ${rr.id} -> missing Room ${rr.roomId}`);
    }
    for (const lc of res.lockCredentials) {
      if (lc.issuedById && !staffIds.has(lc.issuedById)) error(`LockCredential ${lc.id} -> missing Staff ${lc.issuedById}`);
    }
  }

  for (const o of posOrders) {
    if (o.sessionId && !sessionIds.has(o.sessionId)) error(`PosOrder ${o.id} -> missing PosSession ${o.sessionId}`);
    if (o.outletId && !outletIdsSet.has(o.outletId)) error(`PosOrder ${o.id} -> missing Outlet ${o.outletId}`);
    if (o.tableId && !tableIds.has(o.tableId)) error(`PosOrder ${o.id} -> missing Table ${o.tableId}`);
    if (o.openedById && !staffIds.has(o.openedById)) error(`PosOrder ${o.id} -> missing Staff(OpenedBy) ${o.openedById}`);
    if (o.closedById && !staffIds.has(o.closedById)) error(`PosOrder ${o.id} -> missing Staff(ClosedBy) ${o.closedById}`);
    
    for (const i of o.items) {
      if (i.productId && !productIds.has(i.productId)) error(`PosOrderItem ${i.id} -> missing PosProduct ${i.productId}`);
    }
  }

  for (const t of housekeepingTasks) {
    if (t.roomId && !roomIds.has(t.roomId)) error(`HousekeepingTask ${t.id} -> missing Room ${t.roomId}`);
    if (t.assignedToId && !staffIds.has(t.assignedToId)) error(`HousekeepingTask ${t.id} -> missing Staff ${t.assignedToId}`);
  }
  for (const t of maintenanceTickets) {
    if (t.roomId && !roomIds.has(t.roomId)) error(`MaintenanceTicket ${t.id} -> missing Room ${t.roomId}`);
    if (t.assignedToId && !staffIds.has(t.assignedToId)) error(`MaintenanceTicket ${t.id} -> missing Staff ${t.assignedToId}`);
  }
  
  if (errors === 0) console.log("✅ All payload foreign keys are perfectly satisfied!");
  else console.log(`💥 Found ${errors} foreign key violations in the payload!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
