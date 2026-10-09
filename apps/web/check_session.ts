import prisma from '@hotel-pms/db';

async function main() {
  const session = await prisma.posSession.findUnique({
    where: { id: "cbeb420e-69d1-4562-aaa9-03f85558a503" }
  });
  
  console.log(session);
}
main();
