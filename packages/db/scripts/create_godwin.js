const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const property = await prisma.property.findFirst({ where: { name: { contains: 'Stanzel' } } });
  if (!property) return console.log("Property not found");

  const poolBar = await prisma.posOutlet.findFirst({ where: { propertyId: property.id, name: 'STANZELN GRAND RESORT - POOL BAR' } });
  if (!poolBar) return console.log("Pool Bar outlet not found");

  const waiterRole = await prisma.role.findFirst({ where: { name: 'WAITER' } });
  
  const email = 'godwinejikwaje@gmail.com';
  
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const posPinHash = await bcrypt.hash(pin, 10);
  const defaultPassword = await bcrypt.hash('password123', 10);

  // 1. Create Web User
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: defaultPassword
    }
  });

  // 2. Create Staff
  const staff = await prisma.staff.create({
    data: {
      organizationId: property.organizationId, // IMPORTANT: Use correct org
      userId: user.id,
      firstName: 'Odike',
      lastName: 'Godwin',
      email: email,
      department: 'F&B',
      position: 'WAITER',
      propertyAccess: [property.id],
      isActive: true,
      posPinHash: posPinHash,
      hiredAt: new Date()
    }
  });

  // 3. Outlet Access
  await prisma.staffPosOutletAccess.create({
    data: {
      staffId: staff.id,
      outletId: poolBar.id
    }
  });
  
  // 4. Role Mapping
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: waiterRole.id,
      propertyId: property.id,
      grantedBy: user.id
    }
  });

  console.log(`Waiter created successfully!`);
  console.log(`Name: Odike Godwin`);
  console.log(`Email: godwinejikwaje@gmail.com`);
  console.log(`PIN: ${pin}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
