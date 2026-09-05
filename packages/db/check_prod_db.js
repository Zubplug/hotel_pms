const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"
});

async function main() {
  // 1. Find Stanzel Property
  const property = await prisma.property.findFirst({
    where: {
      name: { contains: 'Stanzel', mode: 'insensitive' }
    }
  });

  if (!property) {
    console.error('Property not found');
    return;
  }
  console.log('Property found:', property.name, property.id, 'Org:', property.organizationId);

  // 2. See what roles exist
  const roles = await prisma.role.findMany();
  console.log('Available Roles:', roles.map(r => ({ id: r.id, name: r.name })));

  // 3. See if user exists
  const user = await prisma.user.findUnique({
    where: { email: 'oyibejoeochuko@gmail.com' }
  });
  console.log('User exists?', user ? 'Yes: ' + user.id : 'No');

  // 4. See if staff exists
  if (user) {
    const staff = await prisma.staff.findFirst({
      where: { userId: user.id }
    });
    console.log('Staff exists?', staff ? 'Yes: ' + staff.id : 'No');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
