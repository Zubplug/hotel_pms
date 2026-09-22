import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046'; // Stanzel
    const accounts = await prisma.cityLedgerAccount.findMany({
        where: { propertyId }
    });
    console.log(JSON.stringify(accounts, null, 2));
}

main().finally(() => prisma.$disconnect());
