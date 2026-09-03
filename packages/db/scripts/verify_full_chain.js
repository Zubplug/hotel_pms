const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateRequireOrganizationContext(userId) {
  const membership = await prisma.organizationMembership.findUnique({ where: { userId } });
  if (!membership || membership.status !== 'ACTIVE') return { error: 'No active membership' };

  let propertyIds = [];
  if (['ADMIN', 'SUPER_ADMIN', 'OWNER'].includes(membership.role)) {
    const orgProps = await prisma.property.findMany({ where: { organizationId: membership.organizationId }, select: { id: true, name: true } });
    propertyIds = orgProps;
  } else {
    const userRoles = await prisma.userRole.findMany({ where: { userId, propertyId: { not: null } }, select: { propertyId: true } });
    const ids = userRoles.map(r => r.propertyId);
    const props = await prisma.property.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    propertyIds = props;
  }
  return { membership: { role: membership.role, status: membership.status }, propertyIds };
}

async function main() {
  const emails = [
    'auditor@stanzelgrandresort.com',
    'acillibaby@yahoo.com',
    'fridayekunke@gmail.com',
    'receptionist@ballysplace.com',
  ];

  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    const result = await simulateRequireOrganizationContext(user.id);
    console.log(`\n${email}`);
    console.log('  membership:', result.membership);
    console.log('  properties:', result.propertyIds?.map(p => p.name));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
