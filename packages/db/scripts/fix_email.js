const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const oldEmail = 'acillibaby@yahoo.com';
  const newEmail = 'acilliababy@yahoo.com';

  // Check all tables that have email fields
  const user = await prisma.user.findFirst({ where: { email: oldEmail } });
  const guest = await prisma.guest.findFirst({ where: { email: oldEmail } });

  console.log(`User found: ${user ? `${user.firstName} ${user.lastName} (${user.id})` : 'No'}`);
  console.log(`Guest found: ${guest ? `${guest.firstName} ${guest.lastName} (${guest.id})` : 'No'}`);

  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { email: newEmail, updatedAt: new Date() } });
    console.log(`✅ User email updated: ${oldEmail} → ${newEmail}`);
  }

  if (guest) {
    await prisma.guest.update({ where: { id: guest.id }, data: { email: newEmail, updatedAt: new Date() } });
    console.log(`✅ Guest email updated: ${oldEmail} → ${newEmail}`);
  }

  if (!user && !guest) console.log('⚠️  No record found with that email.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
