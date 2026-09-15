import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const corp = await prisma.corporateAccount.findFirst({
    where: { name: { contains: 'Worldwide Commercial', mode: 'insensitive' } },
    include: { cityLedgerAccount: { include: { entries: true, invoices: true } } }
  });
  if (!corp) { console.log('No corp found'); return; }
  console.log('CityLedgerAccount Balance:', corp.cityLedgerAccount?.balance);
  console.log('Entries:', corp.cityLedgerAccount?.entries.length);
  console.dir(corp.cityLedgerAccount?.entries, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
