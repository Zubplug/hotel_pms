const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const pid = property.id;

  console.log('=== POS OUTLETS ===');
  const outlets = await prisma.posOutlet.findMany({ where: { propertyId: pid } });
  for (const o of outlets) {
    console.log(`- ${o.name} (${o.id})`);
  }

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

  console.log('\n=== INVENTORY ITEMS (STOCK) ===');
  // Check for duplicate inventory names across the property
  const items = await prisma.inventoryItem.findMany({
    where: { propertyId: pid },
    include: { category: true }
  });
  
  console.log(`Total inventory items: ${items.length}`);
  const nameCounts = {};
  for (const item of items) {
    nameCounts[item.name] = (nameCounts[item.name] || 0) + 1;
  }
  
  const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`\nFound ${duplicates.length} items with duplicate names!`);
    for (const [name, count] of duplicates.slice(0, 5)) {
      console.log(`- "${name}" appears ${count} times`);
      const dupItems = items.filter(i => i.name === name);
      for (const di of dupItems) {
        console.log(`   -> ID: ${di.id} | SKU: ${di.sku} | Cat: ${di.category?.name}`);
      }
    }
  } else {
    console.log('\nNo duplicate inventory item names found.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
