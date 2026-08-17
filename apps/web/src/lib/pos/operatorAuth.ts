import { jwtVerify } from 'jose';
import prisma from '@hotel-pms/db';

export interface OperatorTokenPayload {
  staffId:      string;
  propertyId:   string;
  sessionId:    string;
  outletId:     string;
  deviceId:     string;
  tokenVersion: number;
  jti:          string;
  iat:          number;
  exp:          number;
}

function getSecret() {
  if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET missing');
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
}

/**
 * Verifies an operator JWT and returns the typed payload.
 * Validates the token version against the DB to ensure it hasn't been revoked.
 * Returns null if the token is missing, expired, invalid, or revoked.
 */
export async function verifyOperatorToken(
  token: string
): Promise<OperatorTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    const typedPayload = payload as unknown as OperatorTokenPayload;

    const staff = await prisma.staff.findUnique({
      where: { id: typedPayload.staffId }
    });

    if (!staff || !staff.isActive) {
      return null;
    }

    if (staff.posTokenVersion !== typedPayload.tokenVersion) {
      return null; // Token has been revoked
    }

    return typedPayload;
  } catch {
    return null;
  }
}
