import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.corporateAccount.findFirst({
    where: {
      OR: [
        { name: { contains: 'Worldwide Commercial Venture', mode: 'insensitive' } },
        { code: { contains: 'WCV-LTD', mode: 'insensitive' } }
      ]
    },
    include: {
      advancePayments: true,
      folios: true
    }
  });

  if (!account) {
    console.log('Account not found');
    return;
  }

  console.log('Account found:', account.name, account.id);
  console.log('Advance Payments:', JSON.stringify(account.advancePayments, null, 2));
  console.log('Folios length:', account.folios?.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
