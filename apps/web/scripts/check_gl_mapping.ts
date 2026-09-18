import prisma from '@hotel-pms/db';

async function main() {
  const property = await prisma.property.findFirst();
  if (!property) {
    console.log("No property found.");
    return;
  }
  const propertyId = property.id;
  console.log(`Checking mappings for property: ${propertyId}`);

  const cityLedgerMapping = await prisma.paymentMethodGLMapping.findFirst({
    where: { propertyId, method: 'CITY_LEDGER' },
    include: { assetAccount: true }
  });

  console.log("CITY_LEDGER Mapping:", JSON.stringify(cityLedgerMapping, null, 2));

  const guestLedgerMapping = await prisma.paymentMethodGLMapping.findFirst({
    where: { propertyId, method: 'GUEST_LEDGER' },
    include: { assetAccount: true }
  });

  console.log("GUEST_LEDGER Mapping:", JSON.stringify(guestLedgerMapping, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
