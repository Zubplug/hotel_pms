const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'auditor@stanzelgrandresort.com';

  // 1. Check User
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } }
            }
          }
        }
      }
    }
  });

  if (!user) return console.log("❌ User NOT found");
  console.log("✅ User found:", user.id);
  console.log("   Email:", user.email);

  // 2. Check Staff
  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) {
    console.log("❌ Staff profile NOT found");
  } else {
    console.log("\n✅ Staff profile found:", staff.id);
    console.log("   Name:", staff.firstName, staff.lastName);
    console.log("   Position:", staff.position);
    console.log("   Department:", staff.department);
    console.log("   isActive:", staff.isActive);
    console.log("   userId linked:", staff.userId);
    console.log("   propertyAccess:", staff.propertyAccess);

    // Verify property
    if (staff.propertyAccess.length > 0) {
      const property = await prisma.property.findUnique({ where: { id: staff.propertyAccess[0] } });
      console.log("   Property:", property?.name ?? "NOT FOUND");
    }
  }

  // 3. Check User Roles
  console.log("\n✅ Roles assigned:", user.roles.length);
  for (const ur of user.roles) {
    console.log(`   Role: ${ur.role.name}`);
    const property = ur.propertyId ? await prisma.property.findUnique({ where: { id: ur.propertyId } }) : null;
    console.log(`   Property: ${property?.name ?? 'All properties (null)'}`);
    console.log(`   Permissions (${ur.role.permissions.length}):`);
    ur.role.permissions.forEach(rp => {
      console.log(`     ✓ ${rp.permission.name}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
