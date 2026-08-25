import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const propertyId = new URL(req.url).searchParams.get('propertyId');
    if (!propertyId || (!user.isSuperAdmin && !user.allowedProperties.includes(propertyId))) return NextResponse.json({ error: 'Property access denied' }, { status: 403 });
    const memberships = await prisma.userRole.findMany({
      where: { OR: [{ propertyId }, { propertyId: null }], role: { name: { in: ['FRONT_DESK_MANAGER', 'MANAGER', 'FINANCE_MANAGER', 'ADMIN', 'SUPER_ADMIN'] } } },
      include: { user: { select: { id: true, email: true } }, role: { select: { id: true, name: true } } },
      orderBy: { user: { email: 'asc' } }
    });
    const approvers = Array.from(new Map(memberships.map(member => [member.user.id, { id: member.user.id, email: member.user.email, roles: [] as { id: string; name: string }[] }])).values());
    memberships.forEach(member => approvers.find(approver => approver.id === member.user.id)?.roles.push(member.role));
    const roles = Array.from(new Map(memberships.map(member => [member.role.id, member.role])).values());
    return NextResponse.json({ data: { approvers, roles } });
  } catch (error) {
    console.error('[Refund Assignment Options GET]', error);
    return NextResponse.json({ error: 'Unable to load approver options' }, { status: 500 });
  }
}
