import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';
import { z } from 'zod';

const schema = z.object({ token: z.string().min(32), password: z.string().min(12).max(200) });

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Use a password with at least 12 characters.' }, { status: 400 });
    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
    const invitation = await prisma.customerInvitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date() || !invitation.userId) return NextResponse.json({ error: 'This invitation is invalid, expired, or already used.' }, { status: 400 });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: invitation.userId }, data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, sessionVersion: { increment: 1 } } }),
      prisma.customerInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
    return NextResponse.json({ ok: true, email: invitation.email });
  } catch (error) {
    console.error('[portal.customer-invitation] acceptance failed', error);
    return NextResponse.json({ error: 'Unable to activate this invitation' }, { status: 400 });
  }
}
