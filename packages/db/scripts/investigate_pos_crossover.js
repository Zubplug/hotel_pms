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
  const staffAccess = await prisma.posOutletAccess.findMany({
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
  // Let's see if inventory items are linked to specific outlets or just property-wide
  const items = await prisma.inventoryItem.findMany({
    where: { propertyId: pid },
    include: { category: true }
  });
  
  console.log(`Total inventory items: ${items.length}`);
  
  // Let's check for duplicates by name
  const nameCounts = {};
  for (const item of items) {
    nameCounts[item.name] = (nameCounts[item.name] || 0) + 1;
  }
  
  const duplicates = Object.entries(nameCounts).filter(([name, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`\nFound ${duplicates.length} items with duplicate names!`);
    for (const [name, count] of duplicates.slice(0, 5)) {
      console.log(`- "${name}" appears ${count} times`);
      
      // show the specific items
      const dupItems = items.filter(i => i.name === name);
      for (const di of dupItems) {
        console.log(`   -> ID: ${di.id} | SKU: ${di.sku} | Cat: ${di.category?.name}`);
      }
    }
    if (duplicates.length > 5) console.log(`... and ${duplicates.length - 5} more.`);
  } else {
    console.log('\nNo duplicate inventory item names found.');
  }
  
  // Let's also check POS Item mappings (which link inventory to POS)
  console.log('\n=== POS ITEMS (MENU ITEMS) ===');
  const posItems = await prisma.posItem.findMany({
    where: { outlet: { propertyId: pid } },
    include: { outlet: { select: { name: true } }, inventoryItem: { select: { name: true } } }
  });
  
  console.log(`Total POS Menu Items: ${posItems.length}`);
  const posNameCounts = {};
  for (const pi of posItems) {
    const key = `${pi.name} (Outlet: ${pi.outlet?.name})`;
    posNameCounts[key] = (posNameCounts[key] || 0) + 1;
  }
  const posDups = Object.entries(posNameCounts).filter(([k, c]) => c > 1);
  if (posDups.length > 0) {
     console.log(`Found ${posDups.length} duplicate POS items inside the same outlet:`);
     for (const [k, c] of posDups.slice(0, 5)) console.log(`- ${k} (${c}x)`);
  } else {
     console.log('No duplicate POS item names within the same outlet.');
  }

}

main().catch(console.error).finally(() => prisma.$disconnect());
