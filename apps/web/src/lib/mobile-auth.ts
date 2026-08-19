import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.AUTH_SECRET || 'fallback-secret-for-development';

export interface MobileSession {
  id: string;
  email: string;
  staffId: string;
  isSuperAdmin: boolean;
  role: string;
  capabilities: string[];
  sessionVersion: number;
  propertyId: string | null;
  allowedProperties: string[];
}

/**
 * Validates the Bearer JWT issued by /api/manager/auth/login.
 * Returns the decoded session payload, or null if invalid/missing.
 */
export async function verifyMobileToken(req: NextRequest): Promise<MobileSession | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as MobileSession;
  } catch {
    return null;
  }
}
