import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const staffMembers = await prisma.staff.findMany();
  const outlets = await prisma.posOutlet.findMany();

  let count = 0;
  for (const staff of staffMembers) {
    for (const outlet of outlets) {
      try {
        await prisma.staffPosOutletAccess.create({
          data: {
            staffId: staff.id,
            outletId: outlet.id,
          }
        });
        count++;
      } catch (e: any) {
        // Ignore unique constraint violations
        if (e.code !== 'P2002') {
          console.error(e);
        }
      }
    }
  }
  console.log(`Granted access for ${count} staff-outlet pairs.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
