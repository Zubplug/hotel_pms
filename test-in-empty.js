const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
  
  const paymentWhere = { propertyId };
  paymentWhere.id = { in: [] };
  
  const payments = await prisma.payment.findMany({ where: paymentWhere });
  console.log("Payments length:", payments.length);
}
run().catch(console.error).finally(() => prisma.$disconnect());
