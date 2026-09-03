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

  const closedShifts = await prisma.frontDeskShift.findMany({
      where: {
          propertyId: property.id,
          status: 'CLOSED',
          closedAt: {
              gte: today
          }
      },
      include: {
          staff: true,
          closedByStaff: true
      }
  });

  if (closedShifts.length > 0) {
      console.log(`Found ${closedShifts.length} closed shifts today:`);
      for (const shift of closedShifts) {
          console.log(`ID: ${shift.id}, Reference: ${shift.shiftReference}, Opened By: ${shift.staff?.firstName} ${shift.staff?.lastName}, Closed By: ${shift.closedByStaff?.firstName} ${shift.closedByStaff?.lastName}`);
      }
  } else {
      console.log("No closed shifts found today.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
