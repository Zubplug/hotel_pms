import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import prisma from '@hotel-pms/db';
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset';

const genericResponse = { ok: true, message: 'If an account exists for that email, a password reset link has been sent.' };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || email.length > 254) return NextResponse.json(genericResponse);

  // Staff accounts use the same User login identity, but the staff lookup also
  // covers records whose contact email is the canonical address.
  let user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) {
    const staff = await prisma.staff.findUnique({ where: { email }, select: { userId: true } });
    user = staff?.userId
      ? await prisma.user.findUnique({ where: { id: staff.userId }, select: { id: true, email: true } })
      : null;
  }
  if (!user) return NextResponse.json(genericResponse);

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
  });

  const origin = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || request.nextUrl.origin;
  try {
    await sendPasswordResetEmail({ to: user.email, resetUrl: `${origin}/portal/reset-password/${rawToken}`, expiresAt });
  } catch (error) {
    console.error('[portal.forgot-password] email delivery failed', error);
    // Keep the response generic; the token remains unusable without the email.
  }
  return NextResponse.json(genericResponse);
}
