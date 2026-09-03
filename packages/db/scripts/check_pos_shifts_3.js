const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  const allPosShifts = await prisma.posSession.findMany({
    where: { 
      propertyId: property.id,
      status: { not: 'CLOSED' }
    },
    include: {
      primaryOperator: { select: { firstName: true, lastName: true } },
      outlet: { select: { name: true } }
    },
    orderBy: { openedAt: 'desc' }
  });

  console.log(`\nFound ${allPosShifts.length} non-closed POS shift(s):\n`);
  
  for (const shift of allPosShifts) {
    const staffName = `${shift.primaryOperator?.firstName || ''} ${shift.primaryOperator?.lastName || ''}`.trim();
    console.log(`- POS Session ID: ${shift.id}`);
    console.log(`  Outlet: ${shift.outlet?.name || 'Unknown'}`);
    console.log(`  Staff: ${staffName}`);
    console.log(`  Business Date: ${new Date(shift.businessDate).toDateString()}`);
    console.log(`  Opened At: ${shift.openedAt ? new Date(shift.openedAt).toLocaleString() : 'N/A'}`);
    console.log(`  Status: ${shift.status}`);
    console.log('--------------------------------------------------');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
