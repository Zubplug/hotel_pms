import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const guests = await prisma.guest.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Bulus', mode: 'insensitive' } },
        { lastName: { contains: 'Bulus', mode: 'insensitive' } },
      ]
    },
    include: {
      reservations: {
        include: {
          folios: {
            include: {
              payments: true,
              credits: true
            }
          }
        }
      }
    }
  });
  
  console.log(JSON.stringify(guests, null, 2));

  // Check Corporate accounts named bulus
  const corps = await prisma.corporateAccount.findMany({
    where: {
        name: { contains: 'Bulus', mode: 'insensitive' }
    }
  });
  console.log("Corps:", JSON.stringify(corps, null, 2));

  // Check if they mean city ledger entries? 
  // Maybe just check recent City Ledger Entries for Stanzel
  const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046'; // Stanzel Grand Resort
  const ledgers = await prisma.cityLedgerEntry.findMany({
      where: {
          propertyId
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
  });
  console.log("Recent City Ledgers:", JSON.stringify(ledgers, null, 2));
}

main().finally(() => prisma.$disconnect());
