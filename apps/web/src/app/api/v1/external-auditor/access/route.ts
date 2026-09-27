import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { randomUUID } from 'crypto';

/* This route predates the strict session type and is used by the same
 * augmented NextAuth session boundary as the management API. */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'DIRECTOR', 'CEO']);
const canAdminister = (session: any) => Boolean(session?.user?.isSuperAdmin || ADMIN_ROLES.has(String(session?.user?.role || '').toUpperCase()));
const dateOnly = (value: unknown) => {
  const date = new Date(String(value));
  if (!value || Number.isNaN(date.getTime())) throw new Error('Invalid date');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

async function audit(input: { organizationId: string; propertyId: string; userId: string; actorId: string; action: string; resourceId: string; previousValue?: unknown; newValue?: unknown }) {
  await prisma.auditLog.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, userId: input.actorId, action: input.action, resource: 'ExternalAuditorAccess', resourceId: input.resourceId, previousValue: input.previousValue as any, newValue: input.newValue as any, requestId: randomUUID() } });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canAdminister(session)) return NextResponse.json({ error: 'Auditor access administration required' }, { status: 403 });
  try {
    const body = await request.json();
    const userId = String(body.userId || '');
    const propertyId = String(body.propertyId || '');
    const auditPeriodStart = dateOnly(body.auditPeriodStart);
    const auditPeriodEnd = dateOnly(body.auditPeriodEnd);
    const accessStartsAt = body.accessStartsAt ? new Date(body.accessStartsAt) : new Date();
    const accessExpiresAt = new Date(body.accessExpiresAt);
    if (!userId || !propertyId || auditPeriodEnd < auditPeriodStart || Number.isNaN(accessExpiresAt.getTime()) || accessExpiresAt <= accessStartsAt) throw new Error('Invalid auditor access parameters');
    const [user, property, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, organizationId: true } }),
      prisma.role.findFirst({ where: { name: 'EXTERNAL_AUDITOR', isSystem: true } }),
    ]);
    if (!user || !property) return NextResponse.json({ error: 'User or property not found' }, { status: 404 });
    if (!role) return NextResponse.json({ error: 'EXTERNAL_AUDITOR role is not seeded' }, { status: 409 });
    if (!session.user.isSuperAdmin && !(await prisma.userRole.findFirst({ where: { userId: session.user.id, propertyId, role: { name: { in: [...ADMIN_ROLES] } } } }))) return NextResponse.json({ error: 'You cannot administer this property' }, { status: 403 });
    const access = await prisma.$transaction(async tx => {
      await tx.userRole.upsert({ where: { userId_roleId_propertyId: { userId, roleId: role.id, propertyId } }, update: {}, create: { userId, roleId: role.id, propertyId, grantedBy: session.user.id } });
      const created = await tx.externalAuditorAccess.create({ data: { userId, organizationId: property.organizationId, propertyId, auditPeriodStart, auditPeriodEnd, accessStartsAt, accessExpiresAt, grantedByUserId: session.user.id } });
      await tx.auditLog.create({ data: { organizationId: property.organizationId, propertyId, userId: session.user.id, action: 'EXTERNAL_AUDITOR_ACCESS_GRANTED', resource: 'ExternalAuditorAccess', resourceId: created.id, newValue: { userId, auditPeriodStart, auditPeriodEnd, accessExpiresAt }, requestId: randomUUID() } });
      return created;
    });
    return NextResponse.json({ access }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to grant access' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canAdminister(session)) return NextResponse.json({ error: 'Auditor access administration required' }, { status: 403 });
  const propertyId = request.nextUrl.searchParams.get('propertyId');
  const organizationId = String((session.user as any).organizationId || '');
  const [accesses, users, properties] = await Promise.all([
    prisma.externalAuditorAccess.findMany({
    where: { ...(organizationId ? { organizationId } : {}), ...(propertyId ? { propertyId } : {}) },
    include: { user: { select: { id: true, email: true, staffId: true } }, property: { select: { id: true, name: true, code: true } }, grantedByUser: { select: { email: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 250,
    }),
    prisma.user.findMany({ where: { ...(organizationId ? { membership: { organizationId } } : {}) }, select: { id: true, email: true }, orderBy: { email: 'asc' }, take: 500 }),
    prisma.property.findMany({ where: organizationId ? { organizationId } : {}, select: { id: true, name: true, code: true, baseCurrency: true }, orderBy: { name: 'asc' }, take: 250 }),
  ]);
  return NextResponse.json({ accesses, users, properties }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canAdminister(session)) return NextResponse.json({ error: 'Auditor access administration required' }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id || '');
    const current = await prisma.externalAuditorAccess.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: 'Access record not found' }, { status: 404 });
    const action = body.action === 'revoke' ? 'EXTERNAL_AUDITOR_ACCESS_REVOKED' : 'EXTERNAL_AUDITOR_ACCESS_EXTENDED';
    const data = action.endsWith('REVOKED') ? { status: 'REVOKED' as const, revokedAt: new Date(), revokedByUserId: session.user.id, revocationReason: String(body.reason || 'Revoked by administrator') } : { accessExpiresAt: new Date(body.accessExpiresAt), status: 'ACTIVE' as const };
    const updated = await prisma.$transaction(async tx => {
      const value = await tx.externalAuditorAccess.update({ where: { id }, data });
      await tx.auditLog.create({ data: { organizationId: current.organizationId, propertyId: current.propertyId, userId: session.user.id, action, resource: 'ExternalAuditorAccess', resourceId: id, previousValue: current as any, newValue: value as any, requestId: randomUUID() } });
      return value;
    });
    return NextResponse.json({ access: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update access' }, { status: 400 });
  }
}
