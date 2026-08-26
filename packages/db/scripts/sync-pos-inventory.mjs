import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting POS -> Inventory Sync...');

  try {
    // 1. Soft-delete old standalone mock items that aren't linked to POS
    console.log('Soft-deleting unlinked mock inventory items...');
    const deletedCount = await prisma.stockItem.updateMany({
      where: {
        posProductId: null,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
    console.log(`Soft-deleted ${deletedCount.count} obsolete items.`);

    // 2. Fetch all PosOutlets and upsert Warehouses
    console.log('Syncing PosOutlets to Warehouses...');
    const outlets = await prisma.posOutlet.findMany();
    let warehouseCount = 0;

    for (const outlet of outlets) {
      await prisma.warehouse.upsert({
        where: {
          posOutletId: outlet.id,
        },
        update: {
          name: outlet.name,
          isActive: outlet.isActive,
        },
        create: {
          propertyId: outlet.propertyId,
          name: outlet.name,
          posOutletId: outlet.id,
          isActive: outlet.isActive,
        },
      });
      warehouseCount++;
    }
    console.log(`Synced ${warehouseCount} Warehouses.`);

    // 3. Fetch all PosProducts with their categories and outlets
    console.log('Syncing PosProducts to StockItems...');
    const products = await prisma.posProduct.findMany({
      include: {
        category: {
          include: {
            outlet: {
              include: {
                warehouse: true,
              }
            }
          }
        }
      }
    });

    let stockItemCount = 0;
    
    // Chunk array into groups of 20 to speed up execution over the network
    const chunkSize = 20;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (product) => {
        const warehouse = product.category?.outlet?.warehouse;
        if (!warehouse) return;

        await prisma.stockItem.upsert({
          where: {
            posProductId_warehouseId: {
              posProductId: product.id,
              warehouseId: warehouse.id,
            }
          },
          update: {
            name: product.name,
            isActive: product.isActive,
          },
          create: {
            propertyId: product.propertyId,
            warehouseId: warehouse.id,
            posProductId: product.id,
            name: product.name,
            baseUnit: 'PIECE', 
            costPrice: 0,
            quantityOnHand: 0,
            isActive: product.isActive,
          }
        });
        stockItemCount++;
      }));
      
      console.log(`Processed ${stockItemCount} / ${products.length} items...`);
    }
    
    console.log(`Synced ${stockItemCount} Stock Items.`);
    console.log('POS -> Inventory Sync completed successfully.');

  } catch (error) {
    console.error('Error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
