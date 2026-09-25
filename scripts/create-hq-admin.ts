import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'hq@lodgecore.com';
  const plainPassword = 'SuperSecretPassword123!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    const updated = await prisma.user.update({
      where: { email },
      data: { isLodgeCoreAdmin: true, passwordHash }
    });
    console.log(`Updated existing user ${email} to be an HQ Admin.`);
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name: 'LodgeCore HQ Admin',
        passwordHash,
        isLodgeCoreAdmin: true,
      }
    });
    console.log(`Created new HQ Admin user: ${email}`);
  }

  console.log(`Email: ${email}`);
  console.log(`Password: ${plainPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
