import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const property = await prisma.property.findFirst();
  if (!property) return;
  const ratePlan = await prisma.ratePlan.create({
    data: {
      propertyId: property.id,
      name: 'Standard Rate',
      code: 'STD',
      type: 'STANDARD',
      isPublic: true,
      isActive: true,
      minStay: 1
    }
  });
  console.log("Created RatePlan:", ratePlan.id);
}
main().catch(console.error).finally(() => prisma.$disconnect());
