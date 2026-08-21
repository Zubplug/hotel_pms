const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const terminals = await prisma.posTerminal.findMany();
  console.log("Terminals:");
  terminals.forEach(t => console.log(`ID: ${t.id}, Hash Length: ${t.deviceCredentialHash?.length}, RegistrationState: ${t.registrationState}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
