import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScopes, isExternalAuditor } from '@/lib/auth/auditor-utils';

/* NextAuth augments the session user with organization context at runtime. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const propertyId = request.nextUrl.searchParams.get('propertyId');
  const external = isExternalAuditor(session);
  const scopes = external ? await getExternalAuditorScopes(session.user.id) : [];
  const allowedProperties = scopes.map(scope => scope.propertyId);
  if (external && (!propertyId || !allowedProperties.includes(propertyId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const organizationId = String((session.user as any).organizationId || '');
  const scope = external && propertyId ? scopes.find(item => item.propertyId === propertyId) : null;
  const logs = await prisma.auditLog.findMany({ where: { ...(organizationId ? { organizationId } : {}), ...(propertyId ? { propertyId } : external ? { propertyId: { in: allowedProperties } } : {}), ...(scope ? { createdAt: { gte: scope.auditPeriodStart, lte: scope.accessExpiresAt } } : {}) }, select: { id: true, action: true, resource: true, resourceId: true, userEmail: true, userRole: true, requestId: true, ipAddress: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 });
  return NextResponse.json({ items: logs }, { headers: { 'Cache-Control': 'no-store' } });
}
