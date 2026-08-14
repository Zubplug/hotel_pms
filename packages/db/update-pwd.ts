import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password', 10);
  await prisma.user.update({
    where: { email: 'admin@lodgecore.com' },
    data: { passwordHash: hash }
  });
  console.log('Password updated successfully! Hash: ' + hash);
}

main().catch(console.error).finally(() => prisma.$disconnect());
