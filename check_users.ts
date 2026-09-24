import { PrismaClient } from './packages/db/node_modules/@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://neondb_owner:npg_RJcVz67CsOTh@ep-square-frog-b4u924xh-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        }
    }
});

async function main() {
    try {
        console.log("Fetching staff and roles...");
        
        const ballyOrg = await prisma.organization.findFirst({
            where: { name: { contains: 'Bally', mode: 'insensitive' } },
        });
        
        const stanzelOrg = await prisma.organization.findFirst({
            where: { name: { contains: 'Stanzel', mode: 'insensitive' } },
        });

        if (!ballyOrg || !stanzelOrg) return;

        // Fetch staff for Bally
        const ballyStaff = await prisma.staff.findMany({
            where: { organizationId: ballyOrg.id, position: { contains: 'Reception', mode: 'insensitive' } },
            include: { 
                organization: true
            }
        });

        console.log("\n--- BALLY RECEPTION STAFF ---");
        for (const staff of ballyStaff) {
            console.log(`Staff: ${staff.firstName} ${staff.lastName} (ID: ${staff.id}) - Position: ${staff.position}`);
            
            if (staff.userId) {
                const userRoles = await prisma.userRole.findMany({
                    where: { userId: staff.userId },
                    include: { role: { include: { permissions: { include: { permission: true } } } } }
                });
                for (const ur of userRoles) {
                    const hasPerm = ur.role.permissions.some(p => p.permission.name === 'ACCESS_KEYCARD_READ');
                    console.log(`  Assigned Role: ${ur.role.name} - Has ACCESS_KEYCARD_READ: ${hasPerm}`);
                }
            } else {
                console.log("  (No associated user account)");
            }
        }

        // Fetch staff for Stanzel
        const stanzelStaff = await prisma.staff.findMany({
            where: { organizationId: stanzelOrg.id, position: { contains: 'Reception', mode: 'insensitive' } },
            include: { 
                organization: true
            }
        });

        console.log("\n--- STANZEL RECEPTION STAFF ---");
        for (const staff of stanzelStaff) {
            console.log(`Staff: ${staff.firstName} ${staff.lastName} (ID: ${staff.id}) - Position: ${staff.position}`);
            
            if (staff.userId) {
                const userRoles = await prisma.userRole.findMany({
                    where: { userId: staff.userId },
                    include: { role: { include: { permissions: { include: { permission: true } } } } }
                });
                for (const ur of userRoles) {
                    const hasPerm = ur.role.permissions.some(p => p.permission.name === 'ACCESS_KEYCARD_READ');
                    console.log(`  Assigned Role: ${ur.role.name} - Has ACCESS_KEYCARD_READ: ${hasPerm}`);
                }
            } else {
                console.log("  (No associated user account)");
            }
        }
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
