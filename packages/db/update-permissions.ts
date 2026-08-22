import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany({
    where: { name: { in: ['RECEPTIONIST', 'FRONT_DESK'] } }
  });

  const permissionsToGrant = [
    { subject: 'hardware', action: '*' },
    { subject: 'hardware', action: 'manage' },
    { subject: 'reservation', action: '*' },
    { subject: 'reservation', action: 'create' },
    { subject: 'reservation', action: 'update' },
    { subject: 'guest', action: '*' },
    { subject: 'payment', action: '*' },
    { subject: 'room', action: 'change_status' },
    { description: 'Access Front Desk module' }
  ];

  let addedCount = 0;

  for (const role of roles) {
    for (const ptg of permissionsToGrant) {
      let perm;
      if (ptg.description) {
        perm = await prisma.permission.findFirst({ where: { description: ptg.description } });
      } else {
        perm = await prisma.permission.findFirst({ where: { resource: ptg.subject, action: ptg.action } });
      }

      if (perm) {
        const existing = await prisma.rolePermission.findFirst({
          where: { roleId: role.id, permissionId: perm.id }
        });

        if (!existing) {
          await prisma.rolePermission.create({
            data: { roleId: role.id, permissionId: perm.id }
          });
          console.log(`Added permission [${perm.action || perm.description}] to role ${role.name}`);
          addedCount++;
        }
      }
    }
  }

  console.log(`Successfully added ${addedCount} new permissions to Receptionist/Front Desk roles.`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
