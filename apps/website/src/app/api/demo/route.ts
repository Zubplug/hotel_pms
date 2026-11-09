import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { DEMO_ROLES, provisionDemoAccount } from '@/lib/demo-accounts';

export const dynamic = 'force-dynamic';

const schema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(254),
  roleName: z.enum(DEMO_ROLES),
  website: z.string().max(0).optional().or(z.literal('')),
  consent: z.literal(true),
});

function requestIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Complete the form and accept the demo terms.' }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const ip = requestIp(request);
  const demoStore = (prisma as any).demoAccount;
  const [existingUser, recentEmail, recentIp] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    demoStore.count({ where: { email, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    demoStore.count({ where: { createdIp: ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } }),
  ]);
  if (existingUser) return NextResponse.json({ error: 'This email already has an account. Use a different email for the demo.' }, { status: 409 });
  if (recentEmail > 0) return NextResponse.json({ error: 'A demo account was already created for this email in the last 24 hours.' }, { status: 429 });
  if (recentIp >= 5) return NextResponse.json({ error: 'Too many demo requests from this network. Please try again later.' }, { status: 429 });

  try {
    const result = await provisionDemoAccount({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      roleName: parsed.data.roleName,
      createdIp: ip,
    });
    return NextResponse.json({
      ok: true,
      expiresAt: result.demoAccount.expiresAt,
      propertyName: result.property.name,
      organizationName: result.organization.name,
      credentials: { email: result.email, password: result.password, pin: result.pin },
      managementLoginUrl: `${process.env.MANAGEMENT_APP_URL || 'https://lodgecore.vercel.app'}/login`,
    }, { status: 201 });
  } catch (error) {
    console.error('[public.demo] failed', error);
    return NextResponse.json({ error: 'Demo access is not configured yet. Please contact LodgeCore.' }, { status: 503 });
  }
}
