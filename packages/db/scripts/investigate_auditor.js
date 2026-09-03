const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'auditor@stanzelgrandresort.com';
  const user = await prisma.user.findUnique({ where: { email } });
  console.log('\n=== USER ===');
  console.log('id:', user?.id);

  // Check OrganizationMembership (CRITICAL for requireOrganizationContext)
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId: user.id }
  });
  console.log('\n=== ORGANIZATION MEMBERSHIP ===');
  console.log(membership ? JSON.stringify(membership, null, 2) : '❌ NO MEMBERSHIP FOUND');

  // Check UserRoles (used to derive propertyIds)
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true }
  });
  console.log('\n=== USER ROLES ===');
  console.log(JSON.stringify(userRoles, null, 2));

  // Simulate what requireOrganizationContext does
  if (membership) {
    console.log('\n=== SIMULATED propertyIds ===');
    if (['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(membership.role)) {
      const orgProps = await prisma.property.findMany({
        where: { organizationId: membership.organizationId }, select: { id: true, name: true }
      });
      console.log('Admin-level access to all:', orgProps);
    } else {
      const derivedRoles = await prisma.userRole.findMany({
        where: { userId: user.id, propertyId: { not: null } }, select: { propertyId: true }
      });
      console.log('Role-derived propertyIds:', derivedRoles);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
