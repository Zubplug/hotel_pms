import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'oyibejoeochuko@gmail.com';
  const firstName = 'Oyibe';
  const lastName = 'Joe';
  const plainPassword = 'StanzelFNB2026@';
  const roleName = 'FNB_MANAGER';

  // 1. Find Stanzel Property
  const property = await prisma.property.findFirst({
    where: {
      name: { contains: 'Stanzel', mode: 'insensitive' }
    }
  });

  if (!property) {
    throw new Error('Property Stanzel not found');
  }
  console.log(`Found Property: ${property.name} (${property.id}), Org: ${property.organizationId}`);

  // 2. Ensure FNB_MANAGER role exists
  let fnbRole = await prisma.role.findFirst({
    where: { name: roleName, organizationId: property.organizationId }
  });
  if (!fnbRole) {
    fnbRole = await prisma.role.create({
      data: {
        name: roleName,
        description: 'Food & Beverage Manager',
        organizationId: property.organizationId,
        isSystem: true
      }
    });
    console.log(`Created Role: ${roleName}`);
  } else {
    console.log(`Found Role: ${roleName}`);
  }

  // 3. Create or find User
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  let user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      }
    });
    console.log(`Created User: ${email}`);
  } else {
    console.log(`User already exists: ${email}`);
    // Optional: update password if you want to reset it
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    console.log(`Updated password for ${email}`);
  }

  // 4. Ensure OrganizationMembership
  let membership = await prisma.organizationMembership.findUnique({
    where: { userId: user.id }
  });
  if (!membership) {
    membership = await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: property.organizationId,
        role: 'MEMBER'
      }
    });
    console.log(`Created OrganizationMembership for User in Org ${property.organizationId}`);
  }

  // 5. Assign UserRole
  const existingUserRole = await prisma.userRole.findUnique({
    where: {
      userId_roleId_propertyId: {
        userId: user.id,
        roleId: fnbRole.id,
        propertyId: property.id
      }
    }
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: fnbRole.id,
        propertyId: property.id,
        grantedBy: user.id
      }
    });
    console.log(`Assigned role ${roleName} to User for Property ${property.id}`);
  } else {
    console.log(`User already has role ${roleName} for Property ${property.id}`);
  }

  // 6. Ensure Staff Profile exists
  let staff = await prisma.staff.findUnique({
    where: { email }
  });
  
  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        organizationId: property.organizationId,
        userId: user.id,
        firstName,
        lastName,
        email,
        department: 'Food & Beverage',
        position: 'F&B Manager',
        propertyAccess: [property.id],
      }
    });
    console.log(`Created Staff profile for ${firstName} ${lastName}`);
  } else {
    console.log(`Staff profile already exists for ${email}`);
    // Link to user if not linked
    if (!staff.userId) {
      await prisma.staff.update({
        where: { id: staff.id },
        data: { userId: user.id }
      });
      console.log(`Linked existing Staff profile to User`);
    }
  }

  // 7. Ensure User is linked to Staff
  if (!user.staffId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { staffId: staff.id }
    });
    console.log(`Updated User with staffId`);
  }

  console.log(`\nSuccess! F&B Manager created and configured:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${plainPassword}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
