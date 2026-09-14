import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function fix() {
  const newPoolBar = await prisma.posOutlet.findFirst({ where: { name: 'Pool Bar' } });
  const oldPoolBar = await prisma.posOutlet.findFirst({ where: { name: 'STANZELN GRAND RESORT - POOL BAR' } });
  if (newPoolBar && oldPoolBar) {
     await prisma.productCategory.updateMany({
       where: { outletId: newPoolBar.id },
       data: { outletId: oldPoolBar.id }
     });
     await prisma.posOutlet.delete({ where: { id: newPoolBar.id } });
     console.log("Fixed: Moved categories and deleted new Pool Bar");
  } else {
     console.log("Could not find one of the bars");
  }
}
fix().catch(console.error).finally(()=>prisma.$disconnect());
