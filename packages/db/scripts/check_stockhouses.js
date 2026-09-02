const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({
    where: { name: { contains: 'Stanzel' } }
  });
  if (!property) return console.log("Property not found");

  const outlets = await prisma.posOutlet.findMany({
    where: { propertyId: property.id }
  });

  const warehouses = await prisma.warehouse.findMany({
    where: { propertyId: property.id },
    include: { posOutlet: true }
  });

  console.log("=== MAIN WAREHOUSES ===");
  const main = warehouses.filter(w => !w.posOutletId);
  main.forEach(w => console.log(`- ${w.name}`));

  console.log("\n=== OUTLETS & THEIR STOCKHOUSES ===");
  for (const outlet of outlets) {
    const stockhouse = warehouses.find(w => w.posOutletId === outlet.id);
    console.log(`Outlet: ${outlet.name}`);
    console.log(`  -> Stockhouse: ${stockhouse ? stockhouse.name : 'NONE'}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
