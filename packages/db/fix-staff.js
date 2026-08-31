const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { membership: true }
  });
  
  for (const user of users) {
    if (user.membership) {
      const existingStaffById = await prisma.staff.findFirst({
        where: { userId: user.id }
      });
      
      if (!existingStaffById) {
        console.log(`User ${user.email} has no Staff record linked by ID.`);
        
        const existingStaffByEmail = await prisma.staff.findFirst({
          where: { email: user.email }
        });
        
        if (existingStaffByEmail) {
          console.log(`Found unlinked Staff record for ${user.email}. Linking...`);
          await prisma.staff.update({
            where: { id: existingStaffByEmail.id },
            data: { userId: user.id }
          });
          console.log(`-> Linked Staff ${existingStaffByEmail.id} to User ${user.id}`);
        } else {
          console.log(`No Staff record found by email either. Creating new one...`);
          const nameParts = user.email.split('@')[0].split('.');
          const firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'User';
          const lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : 'Staff';
          
          await prisma.staff.create({
            data: {
              organizationId: user.membership.organizationId,
              userId: user.id,
              email: user.email,
              firstName: firstName,
              lastName: lastName,
              department: 'Administration',
              position: user.membership.role === 'ADMIN' || user.membership.role === 'OWNER' ? 'Executive' : 'Staff',
              isActive: true,
            }
          });
          console.log(`-> Created Staff record for ${user.email}`);
        }
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
