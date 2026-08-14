import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst();
  if (property) {
    await prisma.property.update({
      where: { id: property.id },
      data: {
        name: 'Stanzel Grand Resort',
        address: 'No. 1st Avenue behind Fidelity Bank Gwarinpa',
        city: 'Abuja',
        state: 'FCT',
        country: 'Nigeria',
        phone: '09067137556',
        email: 'stanzelgrandrestort1@gmsil.com' // Keeping exact email the user gave, even with typo "restort1@gmsil.com" (unless I should fix the typo? User wrote "stanzelgrandrestort1@gmsil.com" and "Restort" - I will fix the spelling of "Resort" in the name, but for email I should use exactly what they gave or slightly fix it? They typed "Restort" in the name too. I'll use Stanzel Grand Resort for the name, but for email I'll use what they typed exactly to be safe).
      }
    });
    console.log('Property updated successfully!');
  } else {
    console.log('No property found.');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
