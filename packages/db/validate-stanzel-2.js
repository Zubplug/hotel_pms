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

  const activeStaff = await prisma.staff.findMany({ where: { propertyAccess: { has: propertyId }, isActive: true, deletedAt: null } });
  const activeStaffIds = new Set(activeStaff.map(s => s.id));

  // PosSession
  const sessions = await prisma.posSession.findMany({ where: { outlet: { propertyId } } });
  for (const s of sessions) {
    if (s.openedById && !activeStaffIds.has(s.openedById)) console.log(`❌ PosSession ${s.id} openedBy MISSING STAFF: ${s.openedById}`);
    if (s.closedById && !activeStaffIds.has(s.closedById)) console.log(`❌ PosSession ${s.id} closedBy MISSING STAFF: ${s.closedById}`);
  }

  // FrontdeskSession
  const fdSessions = await prisma.frontdeskSession.findMany({ where: { propertyId } });
  for (const s of fdSessions) {
    if (s.openedById && !activeStaffIds.has(s.openedById)) console.log(`❌ FrontdeskSession ${s.id} openedBy MISSING STAFF: ${s.openedById}`);
    if (s.closedById && !activeStaffIds.has(s.closedById)) console.log(`❌ FrontdeskSession ${s.id} closedBy MISSING STAFF: ${s.closedById}`);
  }
  
  // PosOrder Check (openedBy/closedBy)
  const orders = await prisma.posOrder.findMany({ where: { propertyId } });
  for (const s of orders) {
    if (s.openedById && !activeStaffIds.has(s.openedById)) console.log(`❌ PosOrder ${s.id} openedBy MISSING STAFF: ${s.openedById}`);
    if (s.closedById && !activeStaffIds.has(s.closedById)) console.log(`❌ PosOrder ${s.id} closedBy MISSING STAFF: ${s.closedById}`);
  }

  // PosVoids
  const voids = await prisma.posVoid.findMany({ where: { order: { propertyId } } });
  for (const v of voids) {
    if (v.voidedById && !activeStaffIds.has(v.voidedById)) console.log(`❌ PosVoid ${v.id} voidedBy MISSING STAFF: ${v.voidedById}`);
    if (v.authorizedById && !activeStaffIds.has(v.authorizedById)) console.log(`❌ PosVoid ${v.id} authorizedBy MISSING STAFF: ${v.authorizedById}`);
  }
  
  // PosDiscounts
  const discounts = await prisma.posDiscount.findMany({ where: { order: { propertyId } } });
  for (const v of discounts) {
    if (v.appliedById && !activeStaffIds.has(v.appliedById)) console.log(`❌ PosDiscount ${v.id} appliedBy MISSING STAFF: ${v.appliedById}`);
    if (v.authorizedById && !activeStaffIds.has(v.authorizedById)) console.log(`❌ PosDiscount ${v.id} authorizedBy MISSING STAFF: ${v.authorizedById}`);
  }
  
  // Check CashMovements
  const fdMovements = await prisma.cashMovement.findMany({ where: { session: { propertyId } } });
  for (const c of fdMovements) {
    if (c.recordedById && !activeStaffIds.has(c.recordedById)) console.log(`❌ CashMovement ${c.id} recordedBy MISSING STAFF: ${c.recordedById}`);
  }
  
  const posMovements = await prisma.posCashMovement.findMany({ where: { posSession: { outlet: { propertyId } } } });
  for (const c of posMovements) {
    if (c.recordedById && !activeStaffIds.has(c.recordedById)) console.log(`❌ PosCashMovement ${c.id} recordedBy MISSING STAFF: ${c.recordedById}`);
  }

  console.log("Done checking Stanzel property part 2!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
