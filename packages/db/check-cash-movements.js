const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30" }
  }
});

async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  
  const cashMovements = await prisma.posCashMovement.findMany({
    where: { propertyId: propertyId }
  });
  
  const sessions = await prisma.posSession.findMany({ where: { outlet: { propertyId } } });
  const fdSessions = await prisma.frontdeskSession.findMany({ where: { propertyId } });
  const sessionIds = new Set([...sessions.map(s => s.id), ...fdSessions.map(s => s.id)]);

  let errors = 0;
  for (const cm of cashMovements) {
    if (cm.posSessionId && !sessionIds.has(cm.posSessionId)) {
        console.log(`❌ CashMovement ${cm.id} points to missing PosSession ${cm.posSessionId}`);
        errors++;
    }
  }
  if (errors === 0) console.log("✅ CashMovement FKs are clean!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
