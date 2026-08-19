import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { verifyMobileToken } from './mobile-auth';

export interface ResolvedUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  role: string;
  capabilities: string[];
  allowedProperties: string[];
}

/**
 * Resolves the authenticated user from either:
 *  - A mobile Bearer JWT  (issued by /api/manager/auth/login)
 *  - A web NextAuth session cookie
 *
 * Returns null if neither is present / valid.
 */
export async function resolveUser(req: NextRequest): Promise<ResolvedUser | null> {
  // 1. Try mobile Bearer JWT first
  const mobileSession = await verifyMobileToken(req);
  if (mobileSession) {
    return {
      id: mobileSession.id,
      email: mobileSession.email,
      isSuperAdmin: mobileSession.isSuperAdmin,
      role: mobileSession.role,
      capabilities: mobileSession.capabilities,
      allowedProperties: mobileSession.allowedProperties ?? (mobileSession.propertyId ? [mobileSession.propertyId] : []),
    };
  }

  // 2. Fall back to NextAuth web session
  const session = await auth();
  if (session?.user?.id) {
    const { getUserPropertyIds } = await import('./property-access');
    const allowedProperties = await getUserPropertyIds(session.user.id);
    return {
      id: session.user.id,
      email: session.user.email ?? '',
      isSuperAdmin: (session.user as any).isSuperAdmin ?? false,
      role: (session.user as any).role ?? 'STAFF',
      capabilities: (session.user as any).capabilities ?? [],
      allowedProperties,
    };
  }

  return null;
}
