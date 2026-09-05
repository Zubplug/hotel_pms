import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connected to DB:', process.env.DATABASE_URL?.split('@')[1]);

  try {
    const user = await prisma.user.findFirst({
      where: { email: 'oyibejoeochuko@gmail.com' }
    });

    if (!user) {
      console.log('Could not find user.');
      return;
    }

    const staffRecords = await prisma.staff.findMany({
      where: { userId: user.id },
      include: {
        outletAccess: {
          include: { outlet: true }
        }
      }
    });

    let removed = 0;

    for (const staff of staffRecords) {
      for (const access of staff.outletAccess) {
        const outletName = access.outlet.name.toUpperCase();
        if (outletName.includes('FRONTEND') || outletName.includes('LODGECORE')) {
          console.log(`Removing ${access.outlet.name} from Oyibe Joe...`);
          await prisma.staffPosOutletAccess.delete({
            where: { id: access.id }
          });
          removed++;
        } else {
          console.log(`Keeping ${access.outlet.name} for Oyibe Joe`);
        }
      }
    }

    console.log(`Removed ${removed} incorrect outlets. Joe now only has the correct ones.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
