import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading backfill script...');
  const sql = fs.readFileSync('/Users/mac/.gemini/antigravity/brain/295258ac-7538-4faa-86a3-1308f019e770/bulus_backfill_full.sql', 'utf-8');

  console.log('Executing backfill script on production database...');
  // Note: Prisma raw query execution for large scripts can be tricky if they have BEGIN/COMMIT, 
  // but $executeRawUnsafe handles it, or we can just split and execute.
  // Wait, $executeRawUnsafe can execute a multi-statement query if supported. 
  // Let's try it.
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('SUCCESS: Backfill script executed.');
  } catch (err: any) {
    console.error('ERROR executing script:', err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
