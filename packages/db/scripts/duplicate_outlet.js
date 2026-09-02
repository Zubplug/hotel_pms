const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting duplication process...");

  // 1. Lookup Property
  const property = await prisma.property.findFirst({
    where: { name: { contains: 'STANZELN GRAND RESORT' } }
  });
  if (!property) throw new Error("Property not found");
  console.log(`Found Property: ${property.name} (${property.id})`);

  // 2. Lookup Source Outlet
  const sourceOutlet = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id, name: 'STANZELN GRAND RESORT - RESTAURANT & BAR' }
  });
  if (!sourceOutlet) throw new Error("Source outlet not found");
  console.log(`Found Source Outlet: ${sourceOutlet.name} (${sourceOutlet.id})`);

  // 3. Lookup Source Stockhouse (Warehouse)
  const sourceStockhouse = await prisma.warehouse.findFirst({
    where: { propertyId: property.id, posOutletId: sourceOutlet.id }
  });
  if (!sourceStockhouse) throw new Error("Source stockhouse not found");
  console.log(`Found Source Stockhouse: ${sourceStockhouse.name} (${sourceStockhouse.id})`);

  // Dry run mode - just fetch data to see how much we will copy
  const categories = await prisma.productCategory.findMany({
    where: { outletId: sourceOutlet.id }
  });
  console.log(`Will copy ${categories.length} categories.`);

  const products = await prisma.posProduct.findMany({
    where: { categoryId: { in: categories.map(c => c.id) } },
    include: {
      modifiers: true,
      stockItems: true
    }
  });
  console.log(`Will copy ${products.length} products.`);

  let modifierCount = 0;
  let stockItemCount = 0;
  
  for (const p of products) {
    modifierCount += p.modifiers.length;
    stockItemCount += p.stockItems.length; // product stock items
  }

  // Find stock items for modifiers
  const modifierIds = products.flatMap(p => p.modifiers.map(m => m.id));
  const modifierStockItems = await prisma.stockItem.findMany({
    where: { id: { in: products.flatMap(p => p.modifiers.map(m => m.stockItemId).filter(Boolean)) } } // this is a bit complex, let's just count
  });
  // Wait, stockItem for modifier is linked from posProductModifier.stockItemId to stockItem.id
  // But PosProductModifier does not have a reverse relation on StockItem?
  // Let's look at schema: model StockItem has no PosProductModifier[] relation. 
  // It has `posProductId String?`, but not modifier. 
  // So a modifier just links to a StockItem.
  
  console.log(`Will copy ${modifierCount} modifiers.`);
  console.log(`Product stock items to clone: ${stockItemCount}`);
  
  console.log("Ready to execute duplication. Please confirm.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
