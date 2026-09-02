const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting duplication process...");

  // 1. Lookup Property
  const property = await prisma.property.findFirst({
    where: { name: { contains: 'Stanzel' } }
  });
  if (!property) throw new Error("Property not found");
  console.log(`Found Property: ${property.name} (${property.id})`);

  // 2. Lookup Source Outlet
  const sourceOutlet = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id, name: 'STANZELN GRAND RESORT - RESTAURANT & BAR' }
  });
  if (!sourceOutlet) throw new Error("Source outlet not found");
  console.log(`Found Source Outlet: ${sourceOutlet.name} (${sourceOutlet.id})`);

  // 3. Lookup Source Stockhouse
  const sourceStockhouse = await prisma.warehouse.findFirst({
    where: { propertyId: property.id, posOutletId: sourceOutlet.id }
  });
  if (!sourceStockhouse) throw new Error("Source stockhouse not found");
  console.log(`Found Source Stockhouse: ${sourceStockhouse.name} (${sourceStockhouse.id})`);

  await prisma.$transaction(async (tx) => {
    // 4. Create New Outlet
    const newOutlet = await tx.posOutlet.create({
      data: {
        propertyId: property.id,
        name: 'STANZELN GRAND RESORT - POOL BAR',
        type: sourceOutlet.type,
        isActive: true,
        autoLockSeconds: sourceOutlet.autoLockSeconds
      }
    });
    console.log(`Created New Outlet: ${newOutlet.name}`);

    // 5. Create New Stockhouse for the Outlet
    const newStockhouse = await tx.warehouse.create({
      data: {
        propertyId: property.id,
        name: 'STANZELN GRAND RESORT - POOL BAR',
        location: 'POOL BAR',
        isActive: true,
        posOutletId: newOutlet.id
      }
    });
    console.log(`Created New Stockhouse: ${newStockhouse.name}`);

    // 6. Duplicate Categories
    const categories = await tx.productCategory.findMany({
      where: { outletId: sourceOutlet.id }
    });
    
    const categoryMap = {}; // oldId -> newId
    for (const cat of categories) {
      const newCat = await tx.productCategory.create({
        data: {
          outletId: newOutlet.id,
          name: cat.name,
          isActive: cat.isActive,
          sortOrder: cat.sortOrder,
          productionStation: cat.productionStation
        }
      });
      categoryMap[cat.id] = newCat.id;
    }
    console.log(`Duplicated ${categories.length} categories.`);

    // 7. Duplicate Products and Modifiers
    const products = await tx.posProduct.findMany({
      where: { categoryId: { in: categories.map(c => c.id) } },
      include: {
        modifiers: true,
        stockItems: true
      }
    });

    let productCount = 0;
    let modifierCount = 0;
    let stockItemCount = 0;

    for (const prod of products) {
      // If the product had a stock item in the old stockhouse, create a new one in the new stockhouse
      let newStockItemIds = [];
      for (const oldStockItem of prod.stockItems) {
        const newStockItem = await tx.stockItem.create({
          data: {
            propertyId: property.id,
            warehouseId: newStockhouse.id, // Assign to the new stockhouse!
            categoryId: oldStockItem.categoryId,
            name: oldStockItem.name,
            sku: oldStockItem.sku ? oldStockItem.sku + '-PB' : null,
            barcode: oldStockItem.barcode,
            baseUnit: oldStockItem.baseUnit,
            stockType: oldStockItem.stockType,
            costPrice: oldStockItem.costPrice,
            quantityOnHand: 0, // START AT 0!
            reorderLevel: oldStockItem.reorderLevel,
            isActive: oldStockItem.isActive
          }
        });
        newStockItemIds.push(newStockItem.id);
        stockItemCount++;
      }

      // Create the new product
      const newProd = await tx.posProduct.create({
        data: {
          propertyId: property.id,
          categoryId: categoryMap[prod.categoryId],
          name: prod.name,
          description: prod.description,
          price: prod.price,
          taxRate: prod.taxRate,
          isActive: prod.isActive,
          inventoryMode: prod.inventoryMode,
          image: prod.image,
          productionStation: prod.productionStation,
          // Link the newly created stock items
          stockItems: {
            connect: newStockItemIds.map(id => ({ id }))
          }
        }
      });
      productCount++;

      // Create modifiers
      for (const mod of prod.modifiers) {
        let newModStockItemId = null;
        if (mod.stockItemId) {
          const oldModStockItem = await tx.stockItem.findUnique({ where: { id: mod.stockItemId } });
          if (oldModStockItem) {
            const newModStockItem = await tx.stockItem.create({
              data: {
                propertyId: property.id,
                warehouseId: newStockhouse.id,
                categoryId: oldModStockItem.categoryId,
                name: oldModStockItem.name,
                sku: oldModStockItem.sku ? oldModStockItem.sku + '-PB-MOD' : null,
                barcode: oldModStockItem.barcode,
                baseUnit: oldModStockItem.baseUnit,
                stockType: oldModStockItem.stockType,
                costPrice: oldModStockItem.costPrice,
                quantityOnHand: 0, // START AT 0!
                reorderLevel: oldModStockItem.reorderLevel,
                isActive: oldModStockItem.isActive
              }
            });
            newModStockItemId = newModStockItem.id;
            stockItemCount++;
          }
        }

        await tx.posProductModifier.create({
          data: {
            productId: newProd.id,
            name: mod.name,
            price: mod.price,
            isActive: mod.isActive,
            quantity: mod.quantity,
            stockItemId: newModStockItemId
          }
        });
        modifierCount++;
      }
    }

    console.log(`Duplicated ${productCount} products with ${modifierCount} modifiers.`);
    console.log(`Created ${stockItemCount} new stock items for the new stockhouse (with 0 quantity).`);
  }, {
    timeout: 300000 // 30 seconds for transaction
  });

  console.log("Successfully created Pool Bar outlet and stockhouse!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
