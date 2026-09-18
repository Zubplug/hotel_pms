import prisma from '@hotel-pms/db';
import { GLMappingService } from '../src/lib/services/gl-mapping-service';

async function main() {
  const property = await prisma.property.findFirst();
  if (!property) {
    console.log("No property found.");
    return;
  }
  const propertyId = property.id;
  console.log(`Checking COA for property: ${propertyId}`);

  try {
    const cityLedgerId = await GLMappingService.getAssetAccountForMethod(propertyId, 'CITY_LEDGER');
    console.log(`[SUCCESS] CITY_LEDGER mapped to Account ID: ${cityLedgerId}`);
  } catch (e: any) {
    console.log(`[ERROR] CITY_LEDGER mapping failed: ${e.message}`);
  }

  try {
    const guestLedgerId = await GLMappingService.getGuestLedgerAccount(propertyId);
    console.log(`[SUCCESS] GUEST_LEDGER mapped to Account ID: ${guestLedgerId}`);
  } catch (e: any) {
    console.log(`[ERROR] GUEST_LEDGER mapping failed: ${e.message}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
