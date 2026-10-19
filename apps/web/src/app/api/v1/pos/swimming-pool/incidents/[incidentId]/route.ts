import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ incidentId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ctx = await requireOrganizationContext(session.user.id);
  const { incidentId } = await params;
  const body = await req.json();
  const incident = await prisma.poolIncident.findFirst({ where: { id: incidentId, propertyId: { in: ctx.propertyIds as string[] } } });
  if (!incident) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  const status = String(body.status || 'RESOLVED');
  if (!['OPEN', 'INVESTIGATING', 'RESOLVED'].includes(status)) return NextResponse.json({ error: 'Invalid incident status' }, { status: 400 });
  const updated = await prisma.poolIncident.update({ where: { id: incident.id }, data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null, resolvedBy: status === 'RESOLVED' ? session.user.id : null } });
  return NextResponse.json({ data: updated });
}
