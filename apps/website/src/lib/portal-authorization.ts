import prisma, { getEffectiveLimit } from '@hotel-pms/db';
import { auth } from '@/auth';

export async function requirePortalAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!userId || !organizationId) throw new Error('UNAUTHORIZED');

  const membership = await prisma.organizationMembership.findUnique({ where: { userId } });
  if (!membership || membership.organizationId !== organizationId || membership.status !== 'ACTIVE') throw new Error('UNAUTHORIZED');
  if (!['OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(membership.role)) {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { portalOwnerUserId: true } });
    if (organization?.portalOwnerUserId !== userId) throw new Error('FORBIDDEN');
  }
  return { userId, organizationId, membership };
}

export async function portalPropertyLimit(organizationId: string) {
  return getEffectiveLimit(prisma, { organizationId, limit: 'maxProperties' });
}
