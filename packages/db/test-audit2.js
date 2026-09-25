const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const account = await prisma.corporateAccount.findFirst({
    where: {
      name: {
        contains: 'worldwide',
        mode: 'insensitive'
      }
    }
  });

  const cityLedger = await prisma.cityLedgerAccount.findFirst({
    where: {
      name: {
        contains: 'worldwide',
        mode: 'insensitive'
      }
    }
  });

  console.log("Corp Account:", account?.id);
  console.log("City Ledger Account:", cityLedger?.id);

  if (account) {
    const audits1 = await prisma.auditLog.findMany({
      where: {
        resourceId: account.id
      }
    });
    console.log("Audits by corp account ID:", audits1.length);
  }

  if (cityLedger) {
    const audits2 = await prisma.auditLog.findMany({
      where: {
        resourceId: cityLedger.id
      }
    });
    console.log("Audits by city ledger ID:", audits2.length);
    if (audits2.length > 0) {
      console.log(JSON.stringify(audits2[0], null, 2));
    }
  }

  const genericAudits = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2
  });
  console.log("Generic recent audits:");
  console.log(JSON.stringify(genericAudits, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
