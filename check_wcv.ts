import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const corp = await prisma.corporateAccount.findFirst({
    where: { code: 'WCV-LTD' },
    include: {
      CityLedgerAccount: {
        include: {
          entries: true,
          invoices: true
        }
      }
    }
  });
  if (!corp) {
    console.log("No corp found");
    return;
  }
  console.log("Corp:", corp.name);
  console.log("Ledger entries:");
  console.log(JSON.stringify(corp.CityLedgerAccount?.entries, null, 2));
  console.log("Folios or Payments?");
  const payments = await prisma.payment.findMany({
    where: { 
      folio: { 
        reservation: { corporateAccountId: corp.id } 
      }
    }
  });
  console.log("Payments on their reservations:", payments.length);
}
main().catch(console.log).finally(() => prisma.$disconnect());
