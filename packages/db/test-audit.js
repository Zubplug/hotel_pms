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

  if (!account) {
    console.log("Could not find 'worldwide' corporate account.");
    return;
  }

  console.log("Found Corporate Account:", account.name, "| ID:", account.id);

  const audits = await prisma.auditLog.findMany({
    where: {
      resource: 'corporate_account',
      resourceId: account.id
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  });

  console.log("\nRecent Audit Logs for this account:");
  console.log(JSON.stringify(audits, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
