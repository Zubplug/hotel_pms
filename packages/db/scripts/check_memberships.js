const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check all memberships that exist
  const members = await prisma.organizationMembership.findMany({
    include: { user: { select: { email: true } } }
  });
  console.log('=== ALL MEMBERSHIPS ===');
  members.forEach(m => console.log(`${m.user?.email} | role: ${m.role} | status: ${m.status} | orgId: ${m.organizationId}`));

  // Show the org
  const org = await prisma.organization.findFirst();
  console.log('\n=== ORGANIZATION ===');
  console.log(JSON.stringify(org, null, 2));

  // Check all accounts missing memberships
  const usersWithoutMembership = await prisma.user.findMany({
    where: {
      membership: null
    },
    select: { id: true, email: true }
  });
  console.log('\n=== USERS WITHOUT MEMBERSHIP ===');
  usersWithoutMembership.forEach(u => console.log(u.email));
}

main().catch(console.error).finally(() => prisma.$disconnect());
