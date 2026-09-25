import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import prisma from '@hotel-pms/db';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const IMPERSONATION_COOKIE_NAME = 'hq_impersonation_token';

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET or NEXTAUTH_SECRET must be configured');
  return value;
}

function encode(value: string) { return Buffer.from(value).toString('base64url'); }
function sign(value: string) { return encode(createHmac('sha256', secret()).update(value).digest('base64')); }

type ImpersonationContext = {
  hqAdminUserId: string;
  impersonatedUserId: string;
  impersonatedOrganizationId: string;
  startedAt: string;
  endedAt: string;
  reason: string;
};

/**
 * Ensures the current user is a LodgeCore HQ Administrator.
 * Should be called in all /hq routes and HQ server actions.
 */
export async function requireHQAdmin() {
  const session = await auth();
  
  if (!session || !session.user) {
    redirect('/login');
  }

  if (!session.user.isLodgeCoreAdmin) {
    redirect('/'); // Normal users get booted to standard dashboard
  }

  return session.user;
}

/**
 * Retrieves the current impersonation context if one is active.
 * Verifies that the time limit hasn't expired.
 */
export async function getImpersonationContext(): Promise<ImpersonationContext | null> {
  const session = await auth();
  if (!session?.user?.isLodgeCoreAdmin) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(IMPERSONATION_COOKIE_NAME);
  
  if (!token?.value) return null;

  try {
    const [body, signature] = token.value.split('.');
    const expectedSignature = body ? sign(body) : '';
    if (!body || !signature || signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
    const context = JSON.parse(Buffer.from(body, 'base64url').toString()) as ImpersonationContext;
    
    // Check if the impersonation session is time-expired
    if (new Date() > new Date(context.endedAt)) {
      cookieStore.delete(IMPERSONATION_COOKIE_NAME);
      return null;
    }

    return context;
  } catch (e) {
    return null;
  }
}

/**
 * Creates an impersonation context.
 * Max time limit is strictly enforced (default: 2 hours).
 */
export async function startImpersonation(impersonatedUserId: string, reason: string, durationHours: number = 2) {
  const hqAdmin = await requireHQAdmin();
  
  const targetUser = await prisma.user.findUnique({
    where: { id: impersonatedUserId },
    include: {
      membership: true,
      roles: {
        include: { role: true }
      }
    }
  });

  if (!targetUser) throw new Error("Target user not found");

  const targetOrgId = targetUser.roles?.[0]?.role?.organizationId || targetUser.membership?.organizationId;
  
  if (!targetOrgId) throw new Error("Target user is not associated with an organization");

  const startedAt = new Date();
  const safeDurationHours = Math.min(8, Math.max(0.25, Number.isFinite(durationHours) ? durationHours : 2));
  const endedAt = new Date(startedAt.getTime() + safeDurationHours * 60 * 60 * 1000);

  const context: ImpersonationContext = {
    hqAdminUserId: hqAdmin.id,
    impersonatedUserId: targetUser.id,
    impersonatedOrganizationId: targetOrgId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    reason
  };

  const body = encode(JSON.stringify(context));
  const tokenStr = `${body}.${sign(body)}`;

  (await cookies()).set(IMPERSONATION_COOKIE_NAME, tokenStr, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: endedAt,
    path: '/'
  });

  // Log the start of impersonation
  await prisma.auditLog.create({
    data: {
      organizationId: targetOrgId,
      impersonatorUserId: hqAdmin.id,
      userId: targetUser.id,
      userEmail: targetUser.email,
      action: 'IMPERSONATION_STARTED',
      resource: 'User',
      resourceId: targetUser.id,
      requestId: 'hq-' + Date.now(),
        newValue: { reason, durationHours: safeDurationHours, endedAt: endedAt.toISOString() }
    }
  });
}

/**
 * Ends the impersonation context safely.
 */
export async function stopImpersonation() {
  const context = await getImpersonationContext();
  if (context) {
    // Log the end of impersonation
    await prisma.auditLog.create({
      data: {
        organizationId: context.impersonatedOrganizationId,
        impersonatorUserId: context.hqAdminUserId,
        userId: context.impersonatedUserId,
        action: 'IMPERSONATION_ENDED',
        resource: 'User',
        resourceId: context.impersonatedUserId,
        requestId: 'hq-' + Date.now(),
      }
    });
  }

  (await cookies()).delete(IMPERSONATION_COOKIE_NAME);
}
