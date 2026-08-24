const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const terminal = await prisma.posTerminal.findFirst({
    orderBy: { registeredAt: 'desc' }
  });
  
  if (terminal) {
    console.log(`Updating Terminal: ${terminal.name} (${terminal.terminalCode})`);
    
    await prisma.posTerminal.update({
      where: { id: terminal.id },
      data: { propertyId: '9b8a4229-4059-42f4-9565-51cfdbe79046' }
    });
    
    console.log(`Updated Property ID to: 9b8a4229-4059-42f4-9565-51cfdbe79046`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
