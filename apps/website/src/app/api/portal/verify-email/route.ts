import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import prisma from '@hotel-pms/db';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === 'string' ? body.token : '';
  if (token.length < 32) return NextResponse.json({ error: 'Invalid verification link.' }, { status: 400 });
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const verification = await prisma.portalEmailVerification.findUnique({ where: { tokenHash } });
  if (!verification || verification.usedAt || verification.expiresAt <= new Date()) return NextResponse.json({ error: 'This verification link is invalid or expired.' }, { status: 400 });
  await prisma.$transaction([prisma.user.update({ where: { id: verification.userId }, data: { emailVerifiedAt: new Date() } }), prisma.portalEmailVerification.update({ where: { id: verification.id }, data: { usedAt: new Date() } })]);
  return NextResponse.json({ ok: true });
}
