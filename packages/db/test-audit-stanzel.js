const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stanzel = await prisma.property.findFirst({
    where: {
      name: {
        contains: 'stanzel',
        mode: 'insensitive'
      }
    }
  });

  if (!stanzel) {
    console.log("Could not find stanzel property.");
    return;
  }
  
  console.log("Found Stanzel Property:", stanzel.name, "| ID:", stanzel.id);

  const corpAccounts = await prisma.corporateAccount.findMany({
    where: {
      propertyId: stanzel.id
    },
    take: 5
  });

  console.log("\nFound Corp Accounts for Stanzel:");
  for (const acc of corpAccounts) {
    console.log(`- ${acc.name} (ID: ${acc.id})`);
    const audits = await prisma.auditLog.findMany({
      where: {
        resourceId: acc.id
      },
      take: 2,
      orderBy: { createdAt: 'desc' }
    });
    console.log(`  -> Audits: ${audits.length}`);
    if (audits.length > 0) {
      console.log(`  -> Sample audit:`, audits[0]);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
