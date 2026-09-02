const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const STAGING_PERMISSIONS = [
  { name: 'ACCESS_CASH_MANAGEMENT', resource: 'SYSTEM', action: 'ACCESS', description: 'Access Cash Management module' },
  { name: 'inventory.cost.view', resource: 'inventory', action: 'view' },
  { name: 'inventory.recipe.manage', resource: 'inventory', action: 'manage' },
  { name: 'inventory.stocktake.view', resource: 'inventory', action: 'view' },
  { name: 'inventory.stocktake.approve', resource: 'inventory', action: 'approve' },
  { name: 'inventory.grn.view', resource: 'inventory', action: 'view' },
  { name: 'inventory.grn.approve', resource: 'inventory', action: 'approve' },
  { name: 'inventory.variance.view', resource: 'inventory', action: 'view' }
];

async function main() {
  const org = await prisma.organization.findFirst();
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  
  if (!property) return console.log("Property not found");

  // 1. Ensure GENERAL_CASHIER role exists
  let generalCashierRole = await prisma.role.findFirst({
    where: { name: 'GENERAL_CASHIER' }
  });

  if (!generalCashierRole) {
    generalCashierRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: 'GENERAL_CASHIER',
        description: 'General Hotel Cashier',
        isSystem: true
      }
    });
    console.log("Created GENERAL_CASHIER role");
  }

  // 2. Ensure all staging permissions exist and are linked to the role
  for (const p of STAGING_PERMISSIONS) {
    let perm = await prisma.permission.findFirst({ where: { name: p.name } });
    
    if (!perm) {
      perm = await prisma.permission.create({
        data: {
          name: p.name,
          resource: p.resource,
          action: p.action,
          description: p.description || null,
          riskLevel: 'LOW',
          isSystem: true
        }
      });
      console.log(`Created permission: ${p.name}`);
    }

    // Link permission to role
    const mapping = await prisma.rolePermission.findFirst({
      where: { roleId: generalCashierRole.id, permissionId: perm.id }
    });
    
    if (!mapping) {
      await prisma.rolePermission.create({
        data: {
          roleId: generalCashierRole.id,
          permissionId: perm.id
        }
      });
      console.log(`Linked permission ${p.name} to GENERAL_CASHIER`);
    }
  }

  // 3. Create User Account
  const email = 'acillibaby@yahoo.com';
  let user = await prisma.user.findUnique({ where: { email } });
  const rawPassword = 'password123';
  
  if (!user) {
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash
      }
    });
    console.log(`Created User account for ${email}`);
  }

  // 4. Create Staff Profile
  let staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        organizationId: property.organizationId,
        userId: user.id,
        firstName: 'Priscillia',
        lastName: 'Ezeocha',
        email,
        department: 'Finance',
        position: 'GENERAL_CASHIER',
        propertyAccess: [property.id],
        isActive: true,
        hiredAt: new Date()
      }
    });
    console.log(`Created Staff profile for ${email}`);
  }

  // 5. Assign UserRole
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: generalCashierRole.id, propertyId: property.id }
  });
  
  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: generalCashierRole.id,
        propertyId: property.id,
        grantedBy: user.id
      }
    });
    console.log(`Assigned GENERAL_CASHIER role to ${email}`);
  }
  
  console.log("\n--- LOGIN DETAILS ---");
  console.log(`Email: ${email}`);
  console.log(`Password: ${rawPassword}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
