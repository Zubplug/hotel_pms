import { jwtVerify } from 'jose';

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
 * Returns null if the token is missing, expired, or invalid.
 */
export async function verifyOperatorToken(
  token: string
): Promise<OperatorTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return payload as unknown as OperatorTokenPayload;
  } catch {
    return null;
  }
}
