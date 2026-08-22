const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Searching for terminal ending with "002"...');
  const terminals = await prisma.posTerminal.findMany();
  
  const targetTerminals = terminals.filter(t => t.terminalCode.endsWith('02') || t.name.endsWith('02'));
  
  if (targetTerminals.length === 0) {
    console.error('No terminal found ending with "02"');
    console.log('Available terminals:', terminals.map(t => ({ id: t.id, code: t.terminalCode, name: t.name })));
    return;
  }

  console.log('Found terminals:', targetTerminals.length);
  const propertyId = targetTerminals[0].propertyId;

  console.log('Creating new Frontend outlet...');
  const newOutlet = await prisma.posOutlet.create({
    data: {
      name: 'Frontend',
      type: 'FRONT_DESK',
      propertyId: propertyId,
      isActive: true,
      autoLockSeconds: 120
    }
  });

  console.log('Created outlet:', newOutlet);

  console.log('Updating terminals to point to new outlet...');
  const updatedTerminals = await prisma.posTerminal.updateMany({
    where: { id: { in: targetTerminals.map(t => t.id) } },
    data: { outletId: newOutlet.id }
  });

  console.log('Updated terminals successfully:', updatedTerminals);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
