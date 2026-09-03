const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;

  console.log('\n=== STAFF OUTLET ACCESS ===');
  const staffAccess = await prisma.staffPosOutletAccess.findMany({
    where: { outlet: { propertyId: pid } },
    include: { staff: { select: { firstName: true, lastName: true } }, outlet: { select: { name: true } } }
  });
  
  const staffMap = {};
  for (const acc of staffAccess) {
    const name = `${acc.staff?.firstName} ${acc.staff?.lastName}`;
    if (!staffMap[name]) staffMap[name] = [];
    staffMap[name].push(acc.outlet.name);
  }
  for (const [staff, accessList] of Object.entries(staffMap)) {
    console.log(`- ${staff}: ${accessList.join(', ')}`);
  }

  console.log('\n=== POS ITEMS (MENU ITEMS) ===');
  const posItems = await prisma.posProduct.findMany({
    where: { category: { outlet: { propertyId: pid } } },
    include: { category: { include: { outlet: { select: { name: true } } } } }
  }).catch(() => []); // Fallback if schema differs
  
  if (posItems.length > 0) {
    console.log(`Total POS Menu Items: ${posItems.length}`);
    const posNameCounts = {};
    for (const pi of posItems) {
      const key = `${pi.name} (Outlet: ${pi.category?.outlet?.name})`;
      posNameCounts[key] = (posNameCounts[key] || 0) + 1;
    }
    const posDups = Object.entries(posNameCounts).filter(([k, c]) => c > 1);
    if (posDups.length > 0) {
       console.log(`\nFound ${posDups.length} duplicate POS items inside the same outlet:`);
       for (const [k, c] of posDups.slice(0, 5)) console.log(`- ${k} (${c}x)`);
    } else {
       console.log('\nNo duplicate POS item names within the same outlet.');
    }
  } else {
    console.log("Couldn't fetch PosProduct with that schema.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
