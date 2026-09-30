import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import prisma from '@hotel-pms/db';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const IMPERSONATION_COOKIE_NAME = 'hq_impersonation_token';
function secret() { const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET; if (!value) throw new Error('AUTH_SECRET or NEXTAUTH_SECRET must be configured'); return value; }
function encode(value: string) { return Buffer.from(value).toString('base64url'); }
function sign(value: string) { return encode(createHmac('sha256', secret()).update(value).digest('base64')); }

type ImpersonationContext = { hqAdminUserId: string; impersonatedUserId: string; impersonatedOrganizationId: string; startedAt: string; endedAt: string; reason: string };
type HQAdminUser = { id: string; email?: string | null; name?: string | null; isLodgeCoreAdmin: boolean };

export async function requireHQAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/portal/login?callbackUrl=/hq');
  if (!(session.user as typeof session.user & { isLodgeCoreAdmin?: boolean }).isLodgeCoreAdmin) redirect('/');
  return session.user as typeof session.user & HQAdminUser;
}

export async function getImpersonationContext(): Promise<ImpersonationContext | null> {
  const session = await auth();
  if (!(session?.user as { isLodgeCoreAdmin?: boolean } | undefined)?.isLodgeCoreAdmin) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(IMPERSONATION_COOKIE_NAME);
  if (!token?.value) return null;
  try {
    const [body, signature] = token.value.split('.');
    const expectedSignature = body ? sign(body) : '';
    if (!body || !signature || signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
    const context = JSON.parse(Buffer.from(body, 'base64url').toString()) as ImpersonationContext;
    if (new Date() > new Date(context.endedAt)) { cookieStore.delete(IMPERSONATION_COOKIE_NAME); return null; }
    return context;
  } catch { return null; }
}

export async function startImpersonation(impersonatedUserId: string, reason: string, durationHours = 2) {
  const hqAdmin = await requireHQAdmin();
  const targetUser = await prisma.user.findUnique({ where: { id: impersonatedUserId }, include: { membership: true, roles: { include: { role: true } } } });
  if (!targetUser) throw new Error('Target user not found');
  const targetOrgId = targetUser.roles?.[0]?.role?.organizationId || targetUser.membership?.organizationId;
  if (!targetOrgId) throw new Error('Target user is not associated with an organization');
  const startedAt = new Date();
  const safeDurationHours = Math.min(8, Math.max(.25, Number.isFinite(durationHours) ? durationHours : 2));
  const endedAt = new Date(startedAt.getTime() + safeDurationHours * 60 * 60 * 1000);
  const context: ImpersonationContext = { hqAdminUserId: hqAdmin.id, impersonatedUserId: targetUser.id, impersonatedOrganizationId: targetOrgId, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), reason };
  const body = encode(JSON.stringify(context));
  (await cookies()).set(IMPERSONATION_COOKIE_NAME, `${body}.${sign(body)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires: endedAt, path: '/' });
  await prisma.auditLog.create({ data: { organizationId: targetOrgId, impersonatorUserId: hqAdmin.id, userId: targetUser.id, userEmail: targetUser.email, action: 'IMPERSONATION_STARTED', resource: 'User', resourceId: targetUser.id, requestId: `hq-${Date.now()}`, newValue: { reason, durationHours: safeDurationHours, endedAt: endedAt.toISOString() } } });
}

export async function stopImpersonation() { const context = await getImpersonationContext(); if (context) await prisma.auditLog.create({ data: { organizationId: context.impersonatedOrganizationId, impersonatorUserId: context.hqAdminUserId, userId: context.impersonatedUserId, action: 'IMPERSONATION_ENDED', resource: 'User', resourceId: context.impersonatedUserId, requestId: `hq-${Date.now()}` } }); (await cookies()).delete(IMPERSONATION_COOKIE_NAME); }
