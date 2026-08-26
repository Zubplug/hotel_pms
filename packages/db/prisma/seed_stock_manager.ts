import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Stock & Procurement Manager...');

  const org = await prisma.organization.findFirst({
    where: { slug: 'lodgecore' }
  });

  if (!org) {
    throw new Error('Organization lodgecore not found');
  }

  const propLagos = await prisma.property.findFirst({
    where: { code: 'LAG-01' }
  });

  if (!propLagos) {
    throw new Error('Property LAG-01 not found');
  }

  // 1. Ensure roles exist
  const stockRoleName = 'STOCK_MANAGER';
  const procRoleName = 'PROCUREMENT_MANAGER';

  let stockRole = await prisma.role.findFirst({ where: { name: stockRoleName, organizationId: org.id } });
  if (!stockRole) {
    stockRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: stockRoleName,
        isSystem: true,
        description: 'System Role: STOCK_MANAGER'
      }
    });
  }

  let procRole = await prisma.role.findFirst({ where: { name: procRoleName, organizationId: org.id } });
  if (!procRole) {
    procRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: procRoleName,
        isSystem: true,
        description: 'System Role: PROCUREMENT_MANAGER'
      }
    });
  }

  // 2. Create Staff
  const staffEmail = 'stock.manager@lodgecore.com';
  const staff = await prisma.staff.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      organizationId: org.id,
      firstName: 'Jane',
      lastName: 'Stock',
      email: staffEmail,
      department: 'Inventory',
      position: 'Stock & Procurement Manager',
      propertyAccess: [propLagos.id],
    }
  });

  // 3. Create User
  const user = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      staffId: staff.id,
      email: staffEmail,
      passwordHash: '$2b$10$AmpFKjKSql.k2HpbeXE97.d0G27fSY9UfMJvdt9RoCQco1RIT9FlG', // password123
      isSuperAdmin: false,
    }
  });

  // 4. Assign Roles to User
  await prisma.userRole.upsert({
    where: {
      userId_roleId_propertyId: {
        userId: user.id,
        roleId: stockRole.id,
        propertyId: propLagos.id,
      }
    },
    update: {},
    create: {
      userId: user.id,
      roleId: stockRole.id,
      propertyId: propLagos.id,
      grantedBy: user.id,
    }
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_propertyId: {
        userId: user.id,
        roleId: procRole.id,
        propertyId: propLagos.id,
      }
    },
    update: {},
    create: {
      userId: user.id,
      roleId: procRole.id,
      propertyId: propLagos.id,
      grantedBy: user.id,
    }
  });

  console.log(`Successfully seeded! Login Details:`);
  console.log(`Email: ${staffEmail}`);
  console.log(`Password: password123`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
