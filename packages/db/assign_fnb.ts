import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connected to DB:', process.env.DATABASE_URL?.split('@')[1]);

  try {
    // 1. Find Stanzel property
    const stanzel = await prisma.property.findFirst({
      where: {
        name: {
          contains: 'stanzel',
          mode: 'insensitive'
        }
      }
    });

    if (!stanzel) {
      console.log('Could not find Stanzel property.');
      return;
    }

    console.log(`Found Property: ${stanzel.name}`);

    // 2. Find Outlets
    const outlets = await prisma.posOutlet.findMany({
      where: { propertyId: stanzel.id }
    });

    const fnbOutlets = outlets.filter(o => 
      o.name.toUpperCase().includes('BAR') || 
      o.name.toUpperCase().includes('RESTAURANT') ||
      o.name.toUpperCase().includes('FRONTEND') // just in case
    );

    console.log(`Found ${fnbOutlets.length} F&B Outlets to assign.`);
    fnbOutlets.forEach(o => console.log(`  - ${o.name}`));

    // 3. Find FNB Managers
    // Look for users in this organization with FNB_MANAGER role
    const members = await prisma.organizationMembership.findMany({
      where: { organizationId: stanzel.organizationId }
    });
    const fnbMembers = members.filter(m => m.role?.includes('FNB'));

    const userRoles = await prisma.userRole.findMany({
      where: { propertyId: stanzel.id }
    });
    const fnbRoles = userRoles.filter(r => r.role?.includes('FNB'));

    const userIds = [...new Set([...fnbMembers.map(m => m.userId), ...fnbRoles.map(r => r.userId)])];
    console.log(`\nFound ${userIds.length} users with FNB roles.`);

    if (userIds.length === 0) {
      // Let's just find the most recently created staff member in Stanzel
      console.log("No specific FNB_MANAGER role found. Searching for any staff to assign...");
      const staffList = await prisma.staff.findMany({
        where: { organizationId: stanzel.organizationId }
      });
      console.log(`Found ${staffList.length} total staff members in org.`);
      
      for (const staff of staffList) {
        console.log(`Assigning Outlets to Staff: ${staff.firstName} ${staff.lastName} (User: ${staff.user?.email})`);
        
        for (const outlet of fnbOutlets) {
          const exists = await prisma.staffPosOutletAccess.findFirst({
            where: { staffId: staff.id, outletId: outlet.id }
          });
          if (!exists) {
            await prisma.staffPosOutletAccess.create({
              data: { staffId: staff.id, outletId: outlet.id }
            });
            console.log(`  -> Assigned to ${outlet.name}`);
          } else {
            console.log(`  -> Already assigned to ${outlet.name}`);
          }
        }
      }
      return;
    }

    // Assign outlets to specific FNB Managers
    for (const uid of userIds) {
      const staff = await prisma.staff.findFirst({
        where: { userId: uid, organizationId: stanzel.organizationId }
      });

      if (!staff) {
        console.log(`No staff record found for user ID: ${uid}. Skipping.`);
        continue;
      }

      console.log(`\nProcessing Staff: ${staff.firstName} ${staff.lastName} (ID: ${staff.id})`);

      for (const outlet of fnbOutlets) {
        const exists = await prisma.staffPosOutletAccess.findFirst({
          where: { staffId: staff.id, outletId: outlet.id }
        });

        if (!exists) {
          await prisma.staffPosOutletAccess.create({
            data: { staffId: staff.id, outletId: outlet.id }
          });
          console.log(`  -> Assigned to ${outlet.name}`);
        } else {
          console.log(`  -> Already assigned to ${outlet.name}`);
        }
      }
    }

    console.log('\nAll done!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
