const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  
  const res = await prisma.reservation.findMany({ where: { propertyId }, select: { status: true } });
  console.log("Reservation statuses:", [...new Set(res.map(r => r.status))]);
  
  const hk = await prisma.housekeepingTask.findMany({ where: { propertyId }, select: { status: true } });
  console.log("Housekeeping statuses:", [...new Set(hk.map(r => r.status))]);
  
  const mt = await prisma.maintenanceTicket.findMany({ where: { propertyId }, select: { status: true } });
  console.log("Maintenance statuses:", [...new Set(mt.map(r => r.status))]);
  
  const posS = await prisma.posSession.findMany({ where: { propertyId }, select: { status: true } });
  console.log("PosSession statuses:", [...new Set(posS.map(r => r.status))]);
  
  const posO = await prisma.posOrder.findMany({ where: { propertyId }, select: { status: true } });
  console.log("PosOrder statuses:", [...new Set(posO.map(r => r.status))]);
  
  const lockO = await prisma.lockOperation.findMany({ where: { propertyId }, select: { status: true } });
  console.log("LockOperation statuses:", [...new Set(lockO.map(r => r.status))]);
  
  const syncConflicts = await prisma.syncConflict.findMany({ where: { propertyId }, select: { status: true, resolution: true } });
  console.log("SyncConflict statuses:", [...new Set(syncConflicts.map(r => r.status))]);
  console.log("SyncConflict resolutions:", [...new Set(syncConflicts.map(r => r.resolution))]);
  
  const guests = await prisma.guest.findMany({ where: { propertyId }});
  console.log("Guests with deletedAt:", guests.filter(g => g.deletedAt !== null).length);
}
run().catch(console.error).finally(() => prisma.$disconnect());
