const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  const outlets = await prisma.posOutlet.findMany({ where: { propertyId: property.id } });
  
  console.log('=== CATEGORIES ===');
  const categories = await prisma.productCategory.findMany({
    where: { 
       OR: [
          { outletId: { in: outlets.map(o => o.id) } },
          { outletId: null }
       ]
    },
    include: { outlet: true, products: true }
  });
  
  for (const c of categories) {
    const outletName = c.outlet ? c.outlet.name : 'PROPERTY-WIDE (No Outlet)';
    console.log(`- ${c.name} [${outletName}] -> ${c.products.length} products`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
