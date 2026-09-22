import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const entryId = 'c57617d3-20b8-4988-a9b7-aa962381ef20'; // Bulus entry
    const entry = await prisma.cityLedgerEntry.findUnique({
        where: { id: entryId },
        include: { account: true, folio: true }
    });
    console.log(JSON.stringify(entry, null, 2));

    const allCorpAccounts = await prisma.corporateAccount.findMany({
        where: { propertyId: '9b8a4229-4059-42f4-9565-51cfdbe79046' }
    });
    console.log(JSON.stringify(allCorpAccounts, null, 2));
}

main().finally(() => prisma.$disconnect());
