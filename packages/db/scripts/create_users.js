const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  const waiterRole = await prisma.role.findFirst({ where: { name: 'WAITER' } });

  const staffEmails = ['fridayekunke@gmail.com', 'ogechinweke@gmail.com'];
  
  for (const email of staffEmails) {
    const staff = await prisma.staff.findUnique({ where: { email } });
    if (!staff) continue;
    
    // Check if user already exists
    let user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      const defaultPassword = await bcrypt.hash('password123', 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: defaultPassword
        }
      });
      console.log(`Created User for ${email}`);
    }
    
    // Link Staff to User
    await prisma.staff.update({
      where: { id: staff.id },
      data: { userId: user.id }
    });
    console.log(`Linked Staff to User for ${email}`);
    
    // Assign role
    const existingRole = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: waiterRole.id, propertyId: property.id, grantedBy: user.id }
    });
    
    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: waiterRole.id,
          propertyId: property.id, grantedBy: user.id
        }
      });
      console.log(`Assigned WAITER role to ${email}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
