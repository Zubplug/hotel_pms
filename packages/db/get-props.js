const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_RJcVz67CsOTh@ep-square-frog-b4u924xh-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function main() {
  const props = await prisma.property.findMany();
  for (const p of props) {
    console.log(`Property: ${p.id} (${p.name})`);
  }
}
main().finally(() => prisma.$disconnect());
