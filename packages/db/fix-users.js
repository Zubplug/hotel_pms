const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { membership: true, roles: { include: { property: true } } }
  });
  console.log(`Total users: ${users.length}`);
  
  for (const user of users) {
    if (!user.membership) {
      console.log(`User ${user.email} has no membership!`);
      // Find an organization ID. Either from their roles (property -> organization)
      let orgId = null;
      if (user.roles && user.roles.length > 0) {
        for (const r of user.roles) {
          if (r.property && r.property.organizationId) {
            orgId = r.property.organizationId;
            break;
          }
        }
      }
      
      if (!orgId) {
        // Fallback: just get the first organization in the DB
        const org = await prisma.organization.findFirst();
        if (org) orgId = org.id;
      }
      
      if (orgId) {
        await prisma.organizationMembership.create({
          data: {
            id: user.id,
            userId: user.id,
            organizationId: orgId,
            role: user.isSuperAdmin ? 'OWNER' : 'ADMIN',
            status: 'ACTIVE',
            permissions: []
          }
        });
        console.log(`-> Created membership for ${user.email} in org ${orgId}`);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
