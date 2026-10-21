import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@hotel-pms/db';

const schema = z.object({ token: z.string().min(32), password: z.string().min(12).max(200) });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Use a password with at least 12 characters.' }, { status: 400 });
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) return NextResponse.json({ error: 'This password reset link is invalid or expired.' }, { status: 400 });

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    return true;
  });
  if (!updated) return NextResponse.json({ error: 'This password reset link is invalid or expired.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
