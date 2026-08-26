import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting warehouse cleanup...');

  try {
    const keepName = "STANZELN GRAND RESORT - RESTAURANT & BAR";

    // Find warehouses to delete
    const warehousesToDelete = await prisma.warehouse.findMany({
      where: {
        name: { not: keepName }
      },
      select: { id: true, name: true }
    });

    console.log(`Found ${warehousesToDelete.length} warehouses to delete.`);

    for (const w of warehousesToDelete) {
      console.log(`Deleting warehouse: ${w.name} (ID: ${w.id})`);
      
      // Delete associated stock items first to satisfy foreign key constraints
      const deletedItems = await prisma.stockItem.deleteMany({
        where: { warehouseId: w.id }
      });
      console.log(`  - Deleted ${deletedItems.count} associated stock items.`);

      // Now delete the warehouse
      await prisma.warehouse.delete({
        where: { id: w.id }
      });
      console.log(`  - Warehouse deleted.`);
    }

    console.log('Cleanup completed successfully.');

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
