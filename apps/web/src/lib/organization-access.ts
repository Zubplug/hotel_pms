import prisma from '@hotel-pms/db';

export async function getUserOrganizationId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true, staffId: true },
  });

  if (!user) throw new Error('User not found');

  if (user.staffId) {
    const staff = await prisma.staff.findUnique({
      where: { id: user.staffId },
      select: { organizationId: true },
    });
    if (staff) return staff.organizationId;
  }

  // Fallback for SuperAdmins without a Staff record
  const org = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (!org) throw new Error('No organization found');
  return org.id;
}
