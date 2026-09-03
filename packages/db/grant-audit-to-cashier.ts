import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const role = await prisma.role.findFirst({ where: { name: 'GENERAL_CASHIER' } });
  
  if (!role) {
    console.log("No GENERAL_CASHIER role found.");
    return;
  }
  
  const newCaps = [
    { name: 'ACCESS_NIGHT_AUDIT', resource: 'NightAudit', action: 'access' },
    { name: 'night_audit.execute', resource: 'night_audit', action: 'execute' }
  ];
  
  for (const cap of newCaps) {
    let perm = await prisma.permission.findFirst({ where: { name: cap.name } });
    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: cap.name,
          resource: cap.resource,
          action: cap.action
        }
      });
    }
    
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: perm.id
        }
      },
      create: {
        roleId: role.id,
        permissionId: perm.id
      },
      update: {}
    });
  }
  console.log("Updated RolePermission capabilities for Night Audit successfully!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
