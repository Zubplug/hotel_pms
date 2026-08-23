const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sessions = await prisma.posSession.findMany();
    const opSessions = await prisma.posOperatorSession.findMany();
    console.log(`PosSessions count: ${sessions.length}`);
    for(const s of sessions) {
      console.log(`PosSession: ${s.id}, bankType: ${s.bankType}`);
    }
}
main().finally(() => prisma.$disconnect());
