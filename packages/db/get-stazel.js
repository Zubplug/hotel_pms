const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30"
    }
  }
});

async function main() {
  const props = await prisma.property.findMany();
  for (const p of props) {
    if (p.name.toLowerCase().includes('stazel')) {
      console.log(`Found Stazel property: ${p.id} (${p.name})`);
    }
  }
}
main().finally(() => prisma.$disconnect());
