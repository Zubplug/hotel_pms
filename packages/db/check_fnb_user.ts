import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connected to DB:', process.env.DATABASE_URL?.split('@')[1]);

  try {
    // 1. Find users with FNB_MANAGER role or something similar
    const orgMembers = await prisma.organizationMembership.findMany({
      where: {
        role: { contains: 'FNB', mode: 'insensitive' }
      },
      include: {
        user: true,
        organization: true
      }
    });

    console.log(`Found ${orgMembers.length} users with FNB roles in OrganizationMembership.`);
    
    // Also check UserRole if it's there
    const userRoles = await prisma.userRole.findMany({
      where: {
        role: { contains: 'FNB', mode: 'insensitive' }
      },
      include: {
        user: true
      }
    });
    
    console.log(`Found ${userRoles.length} users with FNB roles in UserRole.`);

    const userIds = [...new Set([...orgMembers.map(m => m.userId), ...userRoles.map(r => r.userId)])];

    for (const uid of userIds) {
      console.log(`\n--- Checking User: ${uid} ---`);
      
      const staffRecords = await prisma.staff.findMany({
        where: { userId: uid },
        include: {
          posOutletAccess: {
            include: {
              outlet: true
            }
          }
        }
      });

      console.log(`Found ${staffRecords.length} staff records for this user.`);
      
      for (const staff of staffRecords) {
        console.log(`  Staff ID: ${staff.id} (Status: ${staff.status})`);
        console.log(`  Assigned Outlets (${staff.posOutletAccess.length}):`);
        for (const access of staff.posOutletAccess) {
          console.log(`    - ${access.outlet.name} (ID: ${access.outlet.id})`);
        }
      }
    }
    
    // Also check the user who might be testing right now (by email or recent active)
    console.log('\n--- Checking recent active users ---');
    const recentUsers = await prisma.user.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5
    });
    
    for (const u of recentUsers) {
      const staff = await prisma.staff.findFirst({
        where: { userId: u.id },
        include: { posOutletAccess: { include: { outlet: true } } }
      });
      const member = await prisma.organizationMembership.findFirst({
        where: { userId: u.id }
      });
      
      console.log(`User: ${u.email} (Role: ${member?.role || 'None'})`);
      console.log(`  Assigned Outlets: ${staff?.posOutletAccess.length || 0}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
