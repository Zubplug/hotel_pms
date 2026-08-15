import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'receptionist@lodgecore.com';
  
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  const property = await prisma.property.findFirst();
  if (!property) {
    console.error('No property found!');
    process.exit(1);
  }

  // Check if staff record exists
  let staff = await prisma.staff.findFirst({
    where: { userId: user.id }
  });

  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        userId: user.id,
        organizationId: property.organizationId,
        firstName: 'Jane',
        lastName: 'Frontdesk',
        email: email,
        phone: '555-0100',
        propertyAccess: [property.id],
        isActive: true,
        department: 'Front Desk',
        position: 'Receptionist'
      }
    });
    console.log('Created Staff record with property access');
  } else {
    // Update property access if missing
    if (!staff.propertyAccess.includes(property.id)) {
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          propertyAccess: [...staff.propertyAccess, property.id]
        }
      });
      console.log('Updated Staff record with property access');
    }
  }

  // Verify UserRole
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id }
  });
  
  if (!existingRole?.propertyId) {
    if (existingRole) {
      await prisma.userRole.update({
        where: { id: existingRole.id },
        data: { propertyId: property.id }
      });
      console.log('Fixed propertyId on UserRole');
    }
  }

  console.log('✅ Receptionist access fully linked to property.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
