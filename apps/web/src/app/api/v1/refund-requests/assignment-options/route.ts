import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const canManageWorkflow = user.isSuperAdmin
      || ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CEO', 'FINANCE_MANAGER'].includes(user.role)
      || user.capabilities.includes('MANAGE_REFUND_WORKFLOW');
    if (!canManageWorkflow) return NextResponse.json({ error: 'Refund workflow administrator access required' }, { status: 403 });
    const propertyId = new URL(req.url).searchParams.get('propertyId');
    if (!propertyId || (!user.isSuperAdmin && !user.allowedProperties.includes(propertyId))) return NextResponse.json({ error: 'Property access denied' }, { status: 403 });

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { organizationId: true },
    });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const [roles, memberships] = await Promise.all([
      prisma.role.findMany({
        where: { organizationId: property.organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.userRole.findMany({
        where: {
          OR: [{ propertyId }, { propertyId: null }],
          role: { organizationId: property.organizationId },
        },
        include: { user: { select: { id: true, email: true } }, role: { select: { id: true, name: true } } },
        orderBy: { user: { email: 'asc' } },
      }),
    ]);
    const approvers = Array.from(new Map(memberships.map(member => [member.user.id, { id: member.user.id, email: member.user.email, roles: [] as { id: string; name: string }[] }])).values());
    memberships.forEach(member => approvers.find(approver => approver.id === member.user.id)?.roles.push(member.role));
    return NextResponse.json({ data: { approvers, roles } });
  } catch (error) {
    console.error('[Refund Assignment Options GET]', error);
    return NextResponse.json({ error: 'Unable to load approver options' }, { status: 500 });
  }
}
