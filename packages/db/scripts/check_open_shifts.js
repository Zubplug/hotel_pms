const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  const openShifts = await prisma.frontdeskSession.findMany({
    where: { 
      propertyId: property.id,
      OR: [
        { status: { in: ['OPEN', 'CLOSING'] } },
        { controlStatus: 'OPEN' }
      ]
    },
    include: {
      staff: { select: { firstName: true, lastName: true } }
    },
    orderBy: { openedAt: 'desc' }
  });

  console.log(`\nFound ${openShifts.length} currently open shift(s):\n`);
  
  for (const shift of openShifts) {
    const staffName = `${shift.staff?.firstName || ''} ${shift.staff?.lastName || ''}`.trim();
    console.log(`- Shift Ref: ${shift.shiftReference}`);
    console.log(`  Staff: ${staffName}`);
    console.log(`  Business Date: ${new Date(shift.businessDate).toDateString()}`);
    console.log(`  Opened At: ${shift.openedAt ? new Date(shift.openedAt).toLocaleString() : 'N/A'}`);
    console.log(`  Status: ${shift.status} | Control Status: ${shift.controlStatus}`);
    console.log('--------------------------------------------------');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
