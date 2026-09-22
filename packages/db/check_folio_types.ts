import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const types = await prisma.folio.groupBy({
        by: ['type'],
        _count: { type: true }
    });
    console.log("Folio types in DB:", JSON.stringify(types, null, 2));
}

main().finally(() => prisma.$disconnect());
