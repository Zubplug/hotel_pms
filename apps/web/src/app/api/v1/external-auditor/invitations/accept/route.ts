import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const token = String(body.token || ''); const password = String(body.password || '');
    if (token.length < 32 || password.length < 12) return NextResponse.json({ error: 'The invitation token or password is invalid. Passwords must be at least 12 characters.' }, { status: 400 });
    const invitation = await prisma.externalAuditorInvitation.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date() || !invitation.userId) return NextResponse.json({ error: 'This invitation is invalid, expired, or already used.' }, { status: 400 });
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([prisma.user.update({ where: { id: invitation.userId }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } } }), prisma.externalAuditorInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })]);
    return NextResponse.json({ ok: true });
  } catch (error) { console.error('External auditor invitation acceptance failed', error); return NextResponse.json({ error: 'Unable to activate this invitation' }, { status: 400 }); }
}
