import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connected to DB:', process.env.DATABASE_URL?.split('@')[1]);

  try {
    // Check if parentWarehouseId column exists
    const checkSql = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Warehouse' AND column_name = 'parentWarehouseId';
    `;
    
    const exists = (checkSql as any[]).length > 0;
    console.log('Does parentWarehouseId exist in DB?', exists);

    if (!exists) {
      console.log('Adding parentWarehouseId column and constraint...');
      await prisma.$executeRawUnsafe(`ALTER TABLE "Warehouse" ADD COLUMN "parentWarehouseId" UUID;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_parentWarehouseId_fkey" FOREIGN KEY ("parentWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;`);
      console.log('SQL applied successfully.');
    } else {
      console.log('Column already exists.');
    }

    // Find Stanzel property
    const stanzel = await prisma.property.findFirst({
      where: {
        name: {
          contains: 'stanzel',
          mode: 'insensitive'
        }
      }
    });

    if (!stanzel) {
      console.log('Could not find a property matching "stanzel"');
      return;
    }
    
    console.log('\n--- Property:', stanzel.name, '(', stanzel.id, ') ---');

    // Get Outlets
    const outlets = await prisma.posOutlet.findMany({
      where: { propertyId: stanzel.id }
    });
    console.log(`\nFound ${outlets.length} Outlets:`);
    for (const o of outlets) {
      console.log(` - ${o.name} (ID: ${o.id})`);
    }

    // Get Warehouses
    const warehouses = await prisma.warehouse.findMany({
      where: { propertyId: stanzel.id },
      include: {
        _count: {
          select: { stockItems: true }
        }
      }
    });
    
    console.log(`\nFound ${warehouses.length} Warehouses:`);
    let mainStoreId = null;
    
    for (const w of warehouses) {
      if (!w.posOutletId) {
        mainStoreId = w.id;
      }
      console.log(` - ${w.name} (OutletId: ${w.posOutletId || 'None (Main)'}, ParentId: ${w.parentWarehouseId || 'None'})`);
      console.log(`   Stock Items: ${w._count.stockItems}`);
    }

    // Auto-map warehouses for outlets that don't have one
    let newWarehouses = 0;
    for (const outlet of outlets) {
      const existing = warehouses.find(w => w.posOutletId === outlet.id);
      if (!existing) {
        console.log(`\nCreating Warehouse for Outlet: ${outlet.name}...`);
        await prisma.warehouse.create({
          data: {
            propertyId: stanzel.id,
            name: `${outlet.name} Store`,
            posOutletId: outlet.id,
            parentWarehouseId: mainStoreId // Link to main store if it exists
          }
        });
        newWarehouses++;
      } else if (!existing.parentWarehouseId && mainStoreId && existing.id !== mainStoreId) {
        console.log(`Linking existing Warehouse '${existing.name}' to Main Store...`);
        await prisma.warehouse.update({
          where: { id: existing.id },
          data: { parentWarehouseId: mainStoreId }
        });
      }
    }

    if (newWarehouses > 0) {
      console.log(`\nSuccessfully generated ${newWarehouses} missing warehouse(s).`);
    } else {
      console.log('\nAll outlets already have warehouses.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
