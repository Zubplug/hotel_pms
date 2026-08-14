import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const property = await prisma.property.findFirst();
  console.log("Property:", property?.id);
  const ratePlan = await prisma.ratePlan.findFirst({ where: { propertyId: property?.id } });
  console.log("RatePlan:", ratePlan);
  const staff = await prisma.staff.findFirst();
  console.log("Staff:", staff);
}
main().catch(console.error).finally(() => prisma.$disconnect());
