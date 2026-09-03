const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  if (!property) {
      console.log("Stanzel property not found");
      return;
  }

  // Find closed shifts for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const closedShifts = await prisma.frontdeskSession.findMany({
      where: {
          propertyId: property.id,
          status: 'CLOSED',
          closedAt: {
              gte: today
          }
      },
      include: {
          staff: true
      }
  });

  if (closedShifts.length > 0) {
      console.log(`Found ${closedShifts.length} closed shifts today. Reopening...`);
      for (const shift of closedShifts) {
          await prisma.frontdeskSession.update({
              where: { id: shift.id },
              data: {
                  status: 'OPEN',
                  controlStatus: 'OPEN',
                  closedAt: null,
                  closingAt: null,
                  reconciledAt: null,
                  declaredCash: null,
                  variance: null
              }
          });
          console.log(`✅ Reopened shift: ${shift.shiftReference} (Staff: ${shift.staff?.firstName} ${shift.staff?.lastName})`);
      }
  } else {
      console.log("No closed shifts found today to reopen.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
