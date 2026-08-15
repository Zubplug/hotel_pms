import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const credentialId = 'c9ed5e76-0604-4de0-8d44-a4b6623f609e';
  console.log(`Revoking credential ${credentialId}...`);
  
  await prisma.lockCredential.update({
    where: { id: credentialId },
    data: { 
      status: 'REVOKED',
      revokedAt: new Date()
    }
  });
  
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
