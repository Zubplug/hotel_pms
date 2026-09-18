import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COST_CENTERS = [
  { code: 'ROOMS', name: 'Rooms Division & Front Office', isActive: true },
  { code: 'FNB', name: 'Food & Beverage', isActive: true },
  { code: 'HKP', name: 'Housekeeping', isActive: true },
  { code: 'POM', name: 'Property Operation & Maintenance', isActive: true },
  { code: 'S-M', name: 'Sales & Marketing', isActive: true },
  { code: 'A-G', name: 'Administrative & General', isActive: true },
  { code: 'HR', name: 'Human Resources', isActive: true },
  { code: 'SPA', name: 'Spa & Wellness', isActive: true },
  { code: 'IT', name: 'Information Technology', isActive: true },
];

async function main() {
  const properties = await prisma.property.findMany();
  
  for (const property of properties) {
    console.log(`Processing cost centers for property: ${property.name} (${property.id})`);
    
    for (const cc of COST_CENTERS) {
      const existing = await prisma.costCenter.findFirst({
        where: { propertyId: property.id, code: cc.code }
      });
      if (!existing) {
        await prisma.costCenter.create({
          data: {
            propertyId: property.id,
            ...cc
          }
        });
        console.log(`  + Created Cost Center: ${cc.code} - ${cc.name}`);
      }
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
