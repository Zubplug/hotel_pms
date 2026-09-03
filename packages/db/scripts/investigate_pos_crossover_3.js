const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;

  console.log('=== STOCK ITEMS (INVENTORY) ===');
  const items = await prisma.stockItem.findMany({
    where: { propertyId: pid },
    include: { category: true }
  });
  
  console.log(`Total stock items: ${items.length}`);
  const nameCounts = {};
  for (const item of items) {
    nameCounts[item.name] = (nameCounts[item.name] || 0) + 1;
  }
  
  const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`\nFound ${duplicates.length} stock items with duplicate names!`);
    for (const [name, count] of duplicates.slice(0, 5)) {
      console.log(`- "${name}" appears ${count} times`);
    }
    if (duplicates.length > 5) console.log(`... and ${duplicates.length - 5} more.`);
  } else {
    console.log('\nNo duplicate stock item names found.');
  }
  
  console.log('\n=== POS ITEMS (MENU ITEMS) ===');
  const posItems = await prisma.posItem.findMany({
    where: { outlet: { propertyId: pid } },
    include: { outlet: { select: { name: true } }, stockItem: { select: { name: true } } }
  });
  
  console.log(`Total POS Menu Items: ${posItems.length}`);
  const posNameCounts = {};
  for (const pi of posItems) {
    const key = `${pi.name} (Outlet: ${pi.outlet?.name})`;
    posNameCounts[key] = (posNameCounts[key] || 0) + 1;
  }
  const posDups = Object.entries(posNameCounts).filter(([k, c]) => c > 1);
  if (posDups.length > 0) {
     console.log(`\nFound ${posDups.length} duplicate POS items inside the same outlet:`);
     for (const [k, c] of posDups.slice(0, 5)) console.log(`- ${k} (${c}x)`);
  } else {
     console.log('\nNo duplicate POS item names within the same outlet.');
  }

}

main().catch(console.error).finally(() => prisma.$disconnect());
