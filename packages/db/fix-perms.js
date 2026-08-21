const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const perm = await prisma.permission.findFirst({ where: { name: 'room:change_status' } });
  if (!perm) throw new Error("Permission not found");

  const roles = await prisma.role.findMany({
    where: { name: { in: ['RECEPTIONIST', 'HOUSEKEEPER', 'MAINTENANCE', 'NIGHT_AUDITOR', 'MANAGER'] } }
  });

  console.log(`Found ${roles.length} roles to update.`);

  for (const role of roles) {
    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: perm.id }
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: perm.id
        }
      });
      console.log(`Added room:change_status to ${role.name}`);
    } else {
      console.log(`Role ${role.name} already has room:change_status`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
