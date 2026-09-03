const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  const openPosShifts = await prisma.posSession.findMany({
    where: { 
      propertyId: property.id,
      status: { in: ['OPEN', 'RECONCILIATION_REQUIRED', 'CLOSING'] }
    },
    include: {
      staff: { select: { firstName: true, lastName: true } },
      outlet: { select: { name: true } }
    },
    orderBy: { openedAt: 'desc' }
  });

  console.log(`\nFound ${openPosShifts.length} currently open POS shift(s):\n`);
  
  for (const shift of openPosShifts) {
    const staffName = `${shift.staff?.firstName || ''} ${shift.staff?.lastName || ''}`.trim();
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
