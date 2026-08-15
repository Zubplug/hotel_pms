import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding PENDING lock credentials...');
  
  const pendingCredentials = await prisma.lockCredential.findMany({
    where: { status: 'PENDING' },
  });
  
  console.log(`Found ${pendingCredentials.length} pending credentials.`);

  for (const cred of pendingCredentials) {
    // Find the operation that created this credential
    let operation = null;
    if (cred.issueOperationId) {
      operation = await prisma.lockOperation.findUnique({
        where: { id: cred.issueOperationId },
        include: { command: true }
      });
    } else {
      operation = await prisma.lockOperation.findFirst({
        where: { credentialId: cred.id },
        include: { command: true }
      });
    }

    if (operation && (operation.status === 'SUCCESS' || operation.status === 'COMPLETED')) {
      console.log(`Fixing credential ${cred.id}...`);
      
      const cardSnr = (operation.command?.responseData as any)?.cardSnr 
        || (operation.command?.responseData as any)?.CardSnr 
        || cred.cardSerialNumber;

      await prisma.lockCredential.update({
        where: { id: cred.id },
        data: { 
          status: 'ACTIVE',
          ...(cardSnr && { cardSerialNumber: cardSnr })
        }
      });
      console.log(`✔ Credential ${cred.id} activated.`);
    } else {
      console.log(`Skipping credential ${cred.id} (operation status: ${operation?.status})`);
    }
  }
  
  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
