const { PrismaClient } = require('@hotel-pms/db');
const prisma = new PrismaClient();
async function main() {
  const terminals = await prisma.posTerminal.findMany();
  console.log("Terminals:");
  terminals.forEach((t) => console.log(`ID: ${t.id}, Hash Length: ${t.deviceCredentialHash?.length}, Hash: ${t.deviceCredentialHash}, RegistrationState: ${t.registrationState}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
