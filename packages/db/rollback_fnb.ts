import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connected to DB:', process.env.DATABASE_URL?.split('@')[1]);

  try {
    // We only want to delete StaffPosOutletAccess records created in the last 30 minutes
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Get the staff record for Oyibe Joe so we can exempt him
    const exemptUsers = await prisma.user.findMany({
      where: {
        email: { contains: 'oyib', mode: 'insensitive' }
      }
    });
    
    console.log(`Found ${exemptUsers.length} exempt users matching 'oyib'`);
    exemptUsers.forEach(u => console.log(` - ${u.email} (ID: ${u.id})`));
    
    const exemptStaffIds: string[] = [];
    for (const u of exemptUsers) {
      const st = await prisma.staff.findMany({ where: { userId: u.id } });
      st.forEach(s => exemptStaffIds.push(s.id));
    }

    console.log(`Exempt Staff IDs:`, exemptStaffIds);

    // Find the records created recently
    const recentAccesses = await prisma.staffPosOutletAccess.findMany({
      where: {
        createdAt: { gte: thirtyMinsAgo },
      },
      include: {
        staff: true,
        outlet: true
      }
    });

    console.log(`Found ${recentAccesses.length} recently created access records.`);
    
    let deletedCount = 0;
    
    for (const access of recentAccesses) {
      if (exemptStaffIds.includes(access.staffId)) {
        console.log(`KEEPING: ${access.staff.firstName} ${access.staff.lastName} -> ${access.outlet.name}`);
        continue;
      }
      
      console.log(`DELETING: ${access.staff.firstName} ${access.staff.lastName} -> ${access.outlet.name}`);
      await prisma.staffPosOutletAccess.delete({
        where: { id: access.id }
      });
      deletedCount++;
    }

    console.log(`\nSuccessfully rolled back ${deletedCount} incorrect access assignments.`);
    console.log(`Kept ${recentAccesses.length - deletedCount} assignments for Oyibe Joe.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
