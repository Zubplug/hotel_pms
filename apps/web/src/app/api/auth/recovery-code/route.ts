import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';
import { sendRecoveryCodeEmail } from '@/lib/email/send-password-reset';

const generic = { ok: true, message: 'If an account exists for that email, a verification code has been sent.' };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const purpose = body.purpose === 'PIN' ? 'PIN' : 'PASSWORD';
  if (!email || !email.includes('@') || email.length > 254) return NextResponse.json(generic);

  let user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) {
    const staff = await prisma.staff.findUnique({ where: { email }, select: { userId: true } });
    user = staff?.userId ? await prisma.user.findUnique({ where: { id: staff.userId }, select: { id: true, email: true } }) : null;
  }
  if (!user) return NextResponse.json(generic);

  const code = String(randomInt(100000, 1000000));
  const tokenHash = createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, purpose, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt, purpose, attempts: 0 } });
  });
  try { await sendRecoveryCodeEmail({ to: user.email, code, purpose, expiresAt }); } catch (error) { console.error('[recovery-code] email delivery failed', error); }
  return NextResponse.json(generic);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const purpose = body.purpose === 'PIN' ? 'PIN' : 'PASSWORD';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const newPin = typeof body.newPin === 'string' ? body.newPin : '';
  if (!email || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the six-digit verification code.' }, { status: 400 });
  if (purpose === 'PASSWORD' && newPassword.length < 12) return NextResponse.json({ error: 'Use a password with at least 12 characters.' }, { status: 400 });
  if (purpose === 'PIN' && !/^\d{6}$/.test(newPin)) return NextResponse.json({ error: 'PIN must contain exactly 6 digits.' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: 'The code is invalid or expired.' }, { status: 400 });
  const token = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, purpose, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!token || token.attempts >= 5) return NextResponse.json({ error: 'The code is invalid or expired.' }, { status: 400 });
  if (createHash('sha256').update(code).digest('hex') !== token.tokenHash) {
    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 }, ...(token.attempts >= 4 ? { usedAt: new Date() } : {}) } });
    return NextResponse.json({ error: 'The code is invalid or expired.' }, { status: 400 });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: now } });
    if (purpose === 'PASSWORD') {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12), passwordSetAt: now, sessionVersion: { increment: 1 } } });
    } else {
      await tx.user.update({ where: { id: user.id }, data: { mobilePinHash: await bcrypt.hash(newPin, 12), mobilePinSetAt: now, mobilePinFailedAttempts: 0, mobilePinLockedUntil: null, sessionVersion: { increment: 1 } } });
    }
  });
  return NextResponse.json({ ok: true, reauthenticationRequired: true });
}
