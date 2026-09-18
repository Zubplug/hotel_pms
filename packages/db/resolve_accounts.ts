import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';

  const codes = ['1100', '1110', '1130', '1140'];
  const accounts = await prisma.chartOfAccount.findMany({
    where: { propertyId, code: { in: codes }, isActive: true },
    select: { id: true, code: true, name: true, type: true }
  });
  console.log('GL Accounts:', JSON.stringify(accounts, null, 2));

  // Get active accounting period
  const period = await prisma.accountingPeriod.findFirst({
    where: { propertyId, status: 'OPEN' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Active Period:', JSON.stringify(period, null, 2));

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true }
  });
  console.log('Property orgId:', property?.organizationId);
}

main().catch(console.error).finally(() => prisma.$disconnect());
