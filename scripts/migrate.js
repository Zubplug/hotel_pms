const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Multi-Tenant Data Migration...');

  const staffs = await prisma.staff.findMany({
    where: { userId: { not: null } },
    include: {
      organization: true,
      user: {
        include: {
          roles: {
            include: { role: true }
          }
        }
      }
    }
  });

  console.log(`Found ${staffs.length} Staff records with linked Users.`);

  for (const staff of staffs) {
    if (!staff.userId || !staff.organizationId) continue;

    let membership = await prisma.organizationMembership.findUnique({
      where: { userId: staff.userId }
    });

    if (!membership) {
      let orgRole = 'MEMBER';
      if (staff.user && staff.user.roles) {
        const hasAdminRole = staff.user.roles.some(r => 
          ['ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'OWNER'].includes(r.role.name)
        );
        if (hasAdminRole) {
          orgRole = 'ADMIN';
        }
      }

      membership = await prisma.organizationMembership.create({
        data: {
          id: staff.userId,
          userId: staff.userId,
          organizationId: staff.organizationId,
          role: orgRole,
          status: 'ACTIVE'
        }
      });
      console.log(`Created OrganizationMembership for User ${staff.userId} (Org: ${staff.organizationId}, Role: ${orgRole})`);
    }

    if (staff.propertyAccess && staff.propertyAccess.length > 0 && membership.role !== 'ADMIN') {
      const defaultRole = await prisma.role.findFirst({
        where: { name: 'STAFF' }
      });

      if (defaultRole) {
        for (const propertyId of staff.propertyAccess) {
          const existingUserRole = await prisma.userRole.findFirst({
            where: { 
              userId: staff.userId,
              propertyId: propertyId
            }
          });

          if (!existingUserRole) {
            await prisma.userRole.create({
              data: {
                userId: staff.userId,
                roleId: defaultRole.id,
                propertyId: propertyId
              }
            });
            console.log(`Migrated property access: Created UserRole for User ${staff.userId} at Property ${propertyId}`);
          }
        }
      }
    }
  }

  console.log('Multi-Tenant Data Migration completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
