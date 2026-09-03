const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const AUDITOR_PERMISSIONS = [
  { name: 'ACCESS_FRONT_DESK',   resource: 'SYSTEM',      action: 'ACCESS',        description: 'Access Front Desk module',      riskLevel: 'LOW' },
  { name: 'ACCESS_NIGHT_AUDIT',  resource: 'SYSTEM',      action: 'ACCESS',        description: 'Access Night Audit module',     riskLevel: 'LOW' },
  { name: 'ACCESS_REPORTS',      resource: 'SYSTEM',      action: 'ACCESS',        description: 'Access Reports module',         riskLevel: 'LOW' },
  { name: 'room:change_status',  resource: 'room',        action: 'change_status', description: 'Allows change_status on room',  riskLevel: 'LOW' },
  { name: 'night_audit:execute', resource: 'night_audit', action: 'execute',       description: 'Allows executing the nightly business date rollover, posting room charges, and generating housekeeping tasks.', riskLevel: 'HIGH' }
];

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  if (!property) return console.log("Property not found");

  // 1. Ensure NIGHT_AUDITOR role exists in production
  let auditorRole = await prisma.role.findFirst({ where: { name: 'NIGHT_AUDITOR' } });
  if (!auditorRole) {
    auditorRole = await prisma.role.create({
      data: {
        organizationId: property.organizationId,
        name: 'NIGHT_AUDITOR',
        description: 'System Role: NIGHT_AUDITOR',
        isSystem: true
      }
    });
    console.log("Created NIGHT_AUDITOR role");
  }

  // 2. Ensure all permissions exist and are linked to the role
  for (const p of AUDITOR_PERMISSIONS) {
    let perm = await prisma.permission.findFirst({ where: { name: p.name } });
    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: p.name,
          resource: p.resource,
          action: p.action,
          description: p.description,
          riskLevel: p.riskLevel,
          isSystem: true,
          requiresApproval: false
        }
      });
      console.log(`Created permission: ${p.name}`);
    }

    const mapping = await prisma.rolePermission.findFirst({
      where: { roleId: auditorRole.id, permissionId: perm.id }
    });
    if (!mapping) {
      await prisma.rolePermission.create({
        data: { roleId: auditorRole.id, permissionId: perm.id }
      });
      console.log(`Linked: ${p.name} → NIGHT_AUDITOR`);
    }
  }

  // 3. Create User account
  const email = 'auditor@stanzelgrandresort.com';
  const rawPassword = 'Audit@2026';
  const pin = Math.floor(1000 + Math.random() * 9000).toString();

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    user = await prisma.user.create({
      data: { email, passwordHash }
    });
    console.log(`Created Web User`);
  }

  // 4. Create Staff profile
  let staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) {
    const posPinHash = await bcrypt.hash(pin, 10);
    staff = await prisma.staff.create({
      data: {
        organizationId: property.organizationId,
        userId: user.id,
        firstName: 'Night',
        lastName: 'Auditor',
        email,
        department: 'Finance',
        position: 'NIGHT_AUDITOR',
        propertyAccess: [property.id],
        isActive: true,
        posPinHash,
        hiredAt: new Date()
      }
    });
    console.log(`Created Staff profile`);
  }

  // 5. Assign role
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: auditorRole.id, propertyId: property.id }
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: auditorRole.id,
        propertyId: property.id,
        grantedBy: user.id
      }
    });
    console.log(`Assigned NIGHT_AUDITOR role`);
  }

  console.log("\n--- LOGIN DETAILS ---");
  console.log(`Name:           Night Auditor`);
  console.log(`Email:          ${email}`);
  console.log(`Password:       ${rawPassword}`);
  console.log(`Desktop PIN:    ${pin}`);
  console.log("\nPermissions mirrored from staging:");
  AUDITOR_PERMISSIONS.forEach(p => console.log(`  ✓ ${p.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
