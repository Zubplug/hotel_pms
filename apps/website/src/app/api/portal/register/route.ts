import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { sendPortalVerificationEmail } from '@/lib/email/send-portal-verification';

const schema = z.object({ firstName: z.string().trim().min(1).max(60), middleName: z.string().trim().max(60).optional().or(z.literal('')), lastName: z.string().trim().min(1).max(60), email: z.string().trim().email().max(254), organizationName: z.string().trim().min(2).max(160), propertyName: z.string().trim().min(2).max(160), password: z.string().min(12).max(200), consent: z.literal(true) });
function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'customer'; }

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Complete all fields and use a password with at least 12 characters.' }, { status: 400 });
    const email = parsed.data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return NextResponse.json({ error: 'An account already exists for this email. Sign in or use the demo request flow.' }, { status: 409 });
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const baseSlug = slugify(parsed.data.organizationName);
      let slug = baseSlug;
      for (let index = 2; await tx.organization.findUnique({ where: { slug }, select: { id: true } }); index += 1) slug = `${baseSlug}-${index}`;
      const organization = await tx.organization.create({ data: { name: parsed.data.organizationName, slug } });
      const user = await tx.user.create({ data: { email, firstName: parsed.data.firstName, middleName: parsed.data.middleName || null, lastName: parsed.data.lastName, passwordHash, emailVerifiedAt: null } });
      await tx.organizationMembership.create({ data: { userId: user.id, organizationId: organization.id, role: 'OWNER', status: 'ACTIVE' } });
      await tx.property.create({ data: {
        organizationId: organization.id,
        name: parsed.data.propertyName,
        code: `PROP-${randomUUID().slice(0, 8).toUpperCase()}`,
        address: '',
        city: '',
        state: '',
        country: 'Nigeria',
        phone: '',
        email,
        baseCurrency: 'NGN',
        supportedCurrencies: ['NGN'],
        businessDate: new Date(),
        auditStatus: 'OPEN',
        settings: { onboarding: { needsCompletion: true, source: 'PORTAL_REGISTRATION' } },
      } });
      const verification = await tx.portalEmailVerification.create({ data: { userId: user.id, tokenHash, expiresAt } });
      return { organization, user, verification };
    });
    const origin = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || request.nextUrl.origin;
    try { await sendPortalVerificationEmail({ to: email, verificationUrl: `${origin}/portal/verify-email/${rawToken}`, expiresAt }); }
    catch (error) { await prisma.$transaction([prisma.portalEmailVerification.delete({ where: { id: result.verification.id } }), prisma.organizationMembership.delete({ where: { userId: result.user.id } }), prisma.user.delete({ where: { id: result.user.id } }), prisma.organization.delete({ where: { id: result.organization.id } })]); throw error; }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { console.error('[portal.register] failed', error); return NextResponse.json({ error: 'Unable to create your portal account right now.' }, { status: 500 }); }
}
