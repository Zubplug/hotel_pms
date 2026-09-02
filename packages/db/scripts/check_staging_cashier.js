const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.assronuqrbnqdrcqfhkr:RestoreHope2026%40@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    }
  }
});

async function main() {
  const roles = await prisma.role.findMany({
    where: { 
      OR: [
        { name: { contains: 'CASHIER' } },
        { name: { contains: 'GENERAL' } }
      ]
    },
    include: {
      permissions: {
        include: { permission: true }
      }
    }
  });
  console.dir(roles, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
