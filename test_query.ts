import { PrismaClient } from '@hotel-pms/db';
const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: "00000000-0000-0000-0000-000000000000" },
      include: {
        staff: true
      }
    });
    console.log("Success");
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}
main();
