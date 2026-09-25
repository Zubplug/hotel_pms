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
  console.log("Assigned Rate Plan ID:", account.ratePlanId);

  if (!account.ratePlanId) {
    console.log("This corporate account does not have a rate plan assigned.");
  } else {
    const ratePlan = await prisma.ratePlan.findUnique({
      where: { id: account.ratePlanId },
      include: {
        rates: true
      }
    });
    console.log("\nRate Plan Details:");
    console.log(JSON.stringify(ratePlan, null, 2));
  }
  
  // Just in case, let's see what rate plans exist for this property
  const allRatePlans = await prisma.ratePlan.findMany({
    where: { propertyId: account.propertyId },
    select: { id: true, name: true, code: true, type: true }
  });
  console.log("\nAll Available Rate Plans for this property:");
  console.log(JSON.stringify(allRatePlans, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
