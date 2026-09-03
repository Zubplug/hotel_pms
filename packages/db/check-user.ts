import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: 'ododarlington',
        mode: 'insensitive'
      }
    },
    include: {
      roles: {
        include: {
          role: true
        }
      },
      staff: true
    }
  });

  console.log("Users found:", JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
