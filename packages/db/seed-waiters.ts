import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Get the organization
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('No organization found!');
    process.exit(1);
  }

  const property = await prisma.property.findFirst();
  if (!property) {
    console.error('No property found!');
    process.exit(1);
  }

  // 2. Ensure WAITER role exists
  let role = await prisma.role.findFirst({
    where: { name: 'WAITER' }
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: 'WAITER',
        description: 'Wait staff operations',
        isSystem: true
      }
    });
    console.log('Created WAITER role');
  }

  const waiters = [
    {
      email: 'waiter1@lodgecore.com',
      firstName: 'Tom',
      lastName: 'Waiter',
      pin: '1111'
    },
    {
      email: 'waiter2@lodgecore.com',
      firstName: 'Jerry',
      lastName: 'Waiter',
      pin: '2222'
    }
  ];

  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  for (const w of waiters) {
    let user = await prisma.user.findUnique({
      where: { email: w.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: w.email,
          passwordHash,
          isSuperAdmin: false
        }
      });
      console.log(`Created user: ${w.email}`);
    } else {
      user = await prisma.user.update({
        where: { email: w.email },
        data: { passwordHash }
      });
      console.log(`Updated user password: ${w.email}`);
    }

    let staff = await prisma.staff.findFirst({
      where: { userId: user.id }
    });

    const posPinHash = await bcrypt.hash(w.pin, 10);

    if (!staff) {
      staff = await prisma.staff.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          firstName: w.firstName,
          lastName: w.lastName,
          email: w.email,
          department: 'Food & Beverage',
          position: 'Waiter',
          posPinHash,
          propertyAccess: [property.id],
        }
      });
      console.log(`Created Staff record for ${w.email}`);
    } else {
      staff = await prisma.staff.update({
        where: { id: staff.id },
        data: { posPinHash }
      });
      console.log(`Updated PIN for ${w.email}`);
    }

    if (user.staffId !== staff.id) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { staffId: staff.id }
      });
      console.log(`Linked Staff record to User ${w.email}`);
    }

    const existingRole = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: role.id }
    });

    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
          propertyId: property.id,
          grantedBy: user.id
        }
      });
      console.log(`Assigned WAITER role to ${w.email}`);
    }
  }

  console.log('\n✅ Seed completed successfully!');
  console.log('-------------------------------------------');
  console.log('Wait Staff Login Details:');
  console.log('-------------------------------------------');
  for (const w of waiters) {
    console.log(`Name:     ${w.firstName} ${w.lastName}`);
    console.log(`Email:    ${w.email}`);
    console.log(`Password: ${password}`);
    console.log(`POS PIN:  ${w.pin}`);
    console.log('-------------------------------------------');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
