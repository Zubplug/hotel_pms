const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.staff.findUnique({ where: { email: 'fridayekunke@gmail.com' } });
  if (!staff) return console.log("Staff not found");

  const restaurant = await prisma.posOutlet.findFirst({ where: { name: 'STANZELN GRAND RESORT - RESTAURANT & BAR' } });
  if (!restaurant) return console.log("Restaurant outlet not found");

  const access = await prisma.staffPosOutletAccess.findFirst({
    where: { staffId: staff.id }
  });

  if (access) {
    await prisma.staffPosOutletAccess.update({
      where: { id: access.id },
      data: { outletId: restaurant.id }
    });
    console.log("Moved Friday to Restaurant & Bar!");
  } else {
    await prisma.staffPosOutletAccess.create({
      data: { staffId: staff.id, outletId: restaurant.id }
    });
    console.log("Added access for Friday to Restaurant & Bar!");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
