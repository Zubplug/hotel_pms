const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  
  const models = [
    "reservation", "housekeepingTask", "maintenanceTicket", 
    "posSession", "posOrder", "lockOperation", "folio", "guest", "room", "roomType"
  ];
  
  for (const model of models) {
    if (!prisma[model]) continue;
    try {
      const records = await prisma[model].findMany({ where: { propertyId } });
      const statuses = records.map(r => r.status);
      console.log(`Model: ${model}`);
      console.log(`Has null status:`, statuses.includes(null));
      console.log(`Has undefined status:`, statuses.includes(undefined));
      console.log(`Distinct statuses:`, [...new Set(statuses)]);
    } catch (e) {}
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
