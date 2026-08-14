import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst();
  if (!property) throw new Error("No property found");

  const user = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
  if (!user) throw new Error("No super admin found");

  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(plainToken, 10);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.agentEnrollmentToken.create({
    data: {
      propertyId: property.id,
      tokenHash,
      expiresAt,
      createdBy: user.id,
    },
  });

  console.log('=== ENROLLMENT TOKEN ===');
  console.log(plainToken);
  console.log('========================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
