const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stanzel = await prisma.property.findFirst({
    where: { name: { contains: 'stanzel', mode: 'insensitive' } }
  });

  if (!stanzel) {
    console.log("Could not find stanzel property.");
    return;
  }
  console.log("Property:", stanzel.name, "| OrgID:", stanzel.organizationId);

  const orgAdmins = await prisma.organizationMembership.findMany({
    where: {
      organizationId: stanzel.organizationId,
      role: { in: ['ADMIN', 'SUPER_ADMIN'] }
    },
    include: {
      user: { select: { id: true, email: true } }
    }
  });

  console.log("\nUsers with rate_plan:create via Org Role (ADMIN / SUPER_ADMIN):");
  orgAdmins.forEach(m => {
    console.log(`- ${m.user.email} -> ${m.role}`);
  });

  const rolePermissions = await prisma.rolePermission.findMany({
    where: {
      permission: { name: 'rate_plan:create' }
    },
    include: {
      role: { select: { id: true, name: true } }
    }
  });

  const rolesWithRateCreate = rolePermissions.map(rp => rp.role.id);

  if (rolesWithRateCreate.length === 0) {
    console.log("\nNo custom roles have rate_plan:create permission explicitly.");
  } else {
    const customUsers = await prisma.userRole.findMany({
      where: {
        propertyId: stanzel.id,
        roleId: { in: rolesWithRateCreate }
      },
      include: {
        user: { select: { id: true, email: true } },
        role: { select: { name: true } }
      }
    });

    console.log("\nUsers with rate_plan:create via Custom Property Role:");
    if (customUsers.length === 0) {
      console.log("None.");
    }
    customUsers.forEach(ur => {
      console.log(`- ${ur.user.email} -> Role: ${ur.role.name}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
