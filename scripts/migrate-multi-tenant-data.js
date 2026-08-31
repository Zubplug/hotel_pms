import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('Starting Multi-Tenant Data Migration...');
    // 1. Migrate Users to OrganizationMembership
    // Legacy systems might not have OrganizationMembership records for all users.
    // We need to infer the organization from their linked Staff record.
    const staffs = await prisma.staff.findMany({
        where: { userId: { not: null } },
        include: {
            organization: true,
            user: {
                include: {
                    roles: {
                        include: { role: true }
                    }
                }
            }
        }
    });
    console.log(`Found ${staffs.length} Staff records with linked Users.`);
    for (const staff of staffs) {
        if (!staff.userId || !staff.organizationId)
            continue;
        // Check if membership already exists
        let membership = await prisma.organizationMembership.findUnique({
            where: { userId: staff.userId }
        });
        if (!membership) {
            // Determine Org Role. If user has 'ADMIN' or 'SUPER_ADMIN', they are Org Admin.
            let orgRole = 'MEMBER';
            if (staff.user?.roles) {
                const hasAdminRole = staff.user.roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'OWNER'].includes(r.role.name));
                if (hasAdminRole) {
                    orgRole = 'ADMIN';
                }
            }
            membership = await prisma.organizationMembership.create({
                data: {
                    id: staff.userId, // Optionally map 1:1 if needed, or use a new UUID
                    userId: staff.userId,
                    organizationId: staff.organizationId,
                    role: orgRole,
                    status: 'ACTIVE'
                }
            });
            console.log(`Created OrganizationMembership for User ${staff.userId} (Org: ${staff.organizationId}, Role: ${orgRole})`);
        }
        // 2. Migrate staff.propertyAccess to UserRole mappings
        // The new requireOrganizationContext expects non-admins to have UserRole records tied to a propertyId
        if (staff.propertyAccess && staff.propertyAccess.length > 0 && membership.role !== 'ADMIN') {
            // Find a default role to assign at the property level
            const defaultRole = await prisma.role.findFirst({
                where: { name: 'STAFF' }
            });
            if (defaultRole) {
                for (const propertyId of staff.propertyAccess) {
                    // Check if UserRole already exists for this property
                    const existingUserRole = await prisma.userRole.findFirst({
                        where: {
                            userId: staff.userId,
                            propertyId: propertyId
                        }
                    });
                    if (!existingUserRole) {
                        await prisma.userRole.create({
                            data: {
                                userId: staff.userId,
                                roleId: defaultRole.id,
                                propertyId: propertyId
                            }
                        });
                        console.log(`Migrated property access: Created UserRole for User ${staff.userId} at Property ${propertyId}`);
                    }
                }
            }
        }
    }
    console.log('Multi-Tenant Data Migration completed successfully.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
