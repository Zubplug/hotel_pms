import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing RECEPTIONIST permissions...');

  const role = await prisma.role.findFirst({
    where: { name: 'RECEPTIONIST' }
  });

  if (!role) {
    console.error('RECEPTIONIST role not found!');
    process.exit(1);
  }

  // Permissions to grant to Receptionist
  const permissionsToGrant = [
    { resource: 'reservation', action: '*' },
    { resource: 'reservation', action: 'update' }, // Specific update just in case
    { resource: 'reservation', action: 'create' },
    { resource: 'room', action: 'change_status' },
    { resource: 'room', action: 'view_history' },
    { resource: 'guest', action: '*' },
    { resource: 'payment', action: '*' },
    { resource: 'hardware', action: '*' },
    { resource: 'hardware', action: 'manage' },
    { resource: 'housekeeping', action: 'create' }, // To create tasks
    { resource: 'housekeeping', action: 'update' },
  ];

  for (const p of permissionsToGrant) {
    // 1. Ensure the Permission exists
    const permissionName = `${p.resource}:${p.action}`;
    const permission = await prisma.permission.upsert({
      where: { name: permissionName },
      update: {},
      create: {
        name: permissionName,
        resource: p.resource,
        action: p.action,
        description: `Allows ${p.action} on ${p.resource}`
      }
    });

    // 2. Ensure RolePermission exists
    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId: permission.id }
    });

    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
      console.log(`Granted ${permissionName} to RECEPTIONIST`);
    } else {
      console.log(`RECEPTIONIST already has ${permissionName}`);
    }
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
