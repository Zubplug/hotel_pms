const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Bally' } } });
  if (!property) return console.log("Property not found");

  const org = await prisma.organization.findUnique({ where: { id: property.organizationId } });

  // 1. Ensure RECEPTIONIST role exists
  let receptionistRole = await prisma.role.findFirst({
    where: { name: 'RECEPTIONIST' }
  });

  if (!receptionistRole) {
    receptionistRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: 'RECEPTIONIST',
        description: 'Front Desk Receptionist',
        isSystem: true
      }
    });
    console.log("Created RECEPTIONIST role");
  }

  // 2. We can link some standard front-desk permissions to this role if needed.
  // Standard permission: ACCESS_FRONT_DESK
  let perm = await prisma.permission.findFirst({ where: { name: 'ACCESS_FRONT_DESK' } });
  if (!perm) {
    perm = await prisma.permission.create({
      data: {
        name: 'ACCESS_FRONT_DESK',
        resource: 'SYSTEM',
        action: 'ACCESS',
        description: 'Access Front Desk module',
        riskLevel: 'LOW',
        isSystem: true
      }
    });
  }
  
  const mapping = await prisma.rolePermission.findFirst({
    where: { roleId: receptionistRole.id, permissionId: perm.id }
  });
  if (!mapping) {
    await prisma.rolePermission.create({
      data: { roleId: receptionistRole.id, permissionId: perm.id }
    });
  }

  const email = 'receptionist@ballysplace.com';
  const rawPassword = 'password123';
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  
  let user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    user = await prisma.user.create({
      data: { email, passwordHash }
    });
    console.log(`Created Web User`);
  }

  let staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) {
    const posPinHash = await bcrypt.hash(pin, 10);
    staff = await prisma.staff.create({
      data: {
        organizationId: property.organizationId,
        userId: user.id,
        firstName: 'Ballys',
        lastName: 'Receptionist',
        email,
        department: 'Front Office',
        position: 'RECEPTIONIST',
        propertyAccess: [property.id],
        isActive: true,
        posPinHash,
        hiredAt: new Date()
      }
    });
    console.log(`Created Staff profile`);
  }

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: receptionistRole.id, propertyId: property.id }
  });
  
  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: receptionistRole.id,
        propertyId: property.id,
        grantedBy: user.id
      }
    });
    console.log(`Assigned RECEPTIONIST role`);
  }
  
  console.log("\n--- LOGIN DETAILS ---");
  console.log(`Name: Ballys Receptionist`);
  console.log(`Email: ${email}`);
  console.log(`Web Dashboard Password: ${rawPassword}`);
  console.log(`POS / Desktop PIN: ${pin}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
