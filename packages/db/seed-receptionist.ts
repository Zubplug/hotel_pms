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

  // 2. Ensure RECEPTIONIST role exists
  let role = await prisma.role.findFirst({
    where: { name: 'RECEPTIONIST' }
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: 'RECEPTIONIST',
        description: 'Front desk operations',
        isSystem: true
      }
    });
    console.log('Created RECEPTIONIST role');
  }

  // 3. Create the user
  const email = 'receptionist@lodgecore.com';
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        isSuperAdmin: false
      }
    });
    console.log(`Created user: ${email}`);
  } else {
    // Update password just in case
    user = await prisma.user.update({
      where: { email },
      data: { passwordHash }
    });
    console.log(`Updated user password: ${email}`);
  }

  // 4. Assign role to user
  const property = await prisma.property.findFirst();

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: role.id }
  });

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        propertyId: property?.id,
        grantedBy: user.id // self-granted for seeding
      }
    });
    console.log('Assigned RECEPTIONIST role to user');
  }

  console.log('\n✅ Seed completed successfully!');
  console.log('-------------------------------------------');
  console.log('Login Details:');
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log('-------------------------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
