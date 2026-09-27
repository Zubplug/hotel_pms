import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { sendExternalAuditorInvitationEmail } from '@/lib/email/send-external-auditor-invitation';

/* Auth session fields are augmented by the existing NextAuth configuration. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const admins = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'DIRECTOR', 'CEO']);
const canAdminister = (session: any) => Boolean(session?.user?.isSuperAdmin || session?.user?.isLodgeCoreAdmin || admins.has(String(session?.user?.role || '').toUpperCase()));

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canAdminister(session)) return NextResponse.json({ error: 'Auditor administration required' }, { status: 403 });
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const organizationId = String(body.organizationId || session.user.organizationId || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || !organizationId) return NextResponse.json({ error: 'A valid email and organization are required' }, { status: 400 });
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    const role = await prisma.role.findFirst({ where: { organizationId, name: 'EXTERNAL_AUDITOR', isSystem: true } });
    if (!role) return NextResponse.json({ error: 'EXTERNAL_AUDITOR role is not seeded for this organization' }, { status: 409 });
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const user = await prisma.$transaction(async tx => {
      const existing = await tx.user.findUnique({ where: { email }, include: { membership: true } });
      if (existing?.membership && existing.membership.organizationId !== organizationId) throw new Error('This email belongs to another organization');
      const account = existing || await tx.user.create({ data: { email, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) } });
      await tx.organizationMembership.upsert({ where: { userId: account.id }, update: { organizationId, role: 'EXTERNAL_AUDITOR', status: 'ACTIVE' }, create: { userId: account.id, organizationId, role: 'EXTERNAL_AUDITOR' } });
      const existingRole = await tx.userRole.findFirst({ where: { userId: account.id, roleId: role.id, propertyId: null } });
      if (!existingRole) await tx.userRole.create({ data: { userId: account.id, roleId: role.id, grantedBy: session.user.id } });
      await tx.externalAuditorInvitation.updateMany({ where: { email, organizationId, acceptedAt: null }, data: { expiresAt: new Date() } });
      await tx.externalAuditorInvitation.create({ data: { email, organizationId, userId: account.id, tokenHash, expiresAt, invitedById: session.user.id } });
      return account;
    });
    const origin = request.nextUrl.origin;
    await sendExternalAuditorInvitationEmail({ to: user.email, inviteUrl: `${origin}/external-auditor/invite/${rawToken}`, expiresAt, organizationName: organization.name });
    return NextResponse.json({ ok: true, email: user.email, expiresAt }, { status: 201 });
  } catch (error) {
    console.error('External auditor invitation failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send invitation' }, { status: 400 });
  }
}
