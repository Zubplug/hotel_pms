import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
  
  const accounts = await prisma.cityLedgerAccount.findMany({
    where: { propertyId },
    select: { id: true, name: true, type: true, balance: true }
  });
  console.log("--- ACCOUNTS ---");
  console.table(accounts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
