import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const role = await prisma.role.findFirst({ where: { name: 'GENERAL_CASHIER' } });
  
  if (!role) {
    console.log("No GENERAL_CASHIER role found.");
    return;
  }
  
  const newCaps = [
    'inventory.cost.view',
    'inventory.recipe.manage',
    'inventory.stocktake.view',
    'inventory.stocktake.approve',
    'inventory.grn.view',
    'inventory.grn.approve',
    'inventory.variance.view'
  ];
  
  for (const cap of newCaps) {
    let perm = await prisma.permission.findUnique({ where: { name: cap } });
    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: cap,
          resource: cap.split('.')[0],
          action: cap.split('.')[2] || 'manage'
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
  console.log("Updated RolePermission capabilities successfully!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
