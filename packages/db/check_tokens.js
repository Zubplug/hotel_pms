const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tokens = await prisma.deviceToken.findMany({
    where: { userId: 'f3c06188-c2a5-4804-87e3-d853d4b164c3' }
  });
  console.log('Total tokens: ' + tokens.length);
  console.log(JSON.stringify(tokens, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
