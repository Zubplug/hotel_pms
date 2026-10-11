/**
 * HMAC-SHA256 signed QR tokens for Room Service.
 *
 * Format (before base64url encoding):
 *   <propertyId>:<roomId>:<16-hex-char HMAC digest>
 *
 * Security properties:
 *   - Guests cannot forge a valid token without knowing QR_ROOM_SERVICE_SECRET.
 *   - Changing the secret in env invalidates ALL outstanding printed QR codes.
 *     Only do this if cards are physically replaced.
 *   - Tokens are intentionally non-expiring — they are printed on paper tent cards
 *     that stay in rooms for months.  Rotate the secret + reprint cards on a
 *     regular schedule (e.g., annually) or when a security incident occurs.
 */

import { createHmac } from 'crypto';

/**
 * Returns the active signing secret.
 *
 * Resolution order:
 *   1. QR_ROOM_SERVICE_SECRET  (preferred — rotate independently of auth)
 *   2. AUTH_SECRET             (acceptable fallback so first-deploy needs no extra var)
 *
 * Throws at call time if neither is set.  This causes the Next.js process to
 * surface a 500 on the first request rather than silently signing tokens with
 * an empty/predictable key — exactly what we want for a hard production check.
 */
function getSecret(): string {
  const secret = process.env.QR_ROOM_SERVICE_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      '[qrToken] No signing secret configured. ' +
      'Set QR_ROOM_SERVICE_SECRET (or AUTH_SECRET as a fallback) in your environment. ' +
      'This is a hard startup check — the QR room service feature will not operate ' +
      'with an empty secret.'
    );
  }
  return secret;
}

/** Produce a URL-safe signed token embedding propertyId + roomId. */
export function signRoomQrToken(propertyId: string, roomId: string): string {
  const payload = `${propertyId}:${roomId}`;
  const sig = createHmac('sha256', getSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 16); // 64-bit prefix is plenty for MAC-forgery resistance
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

/**
 * Verify a token and return the embedded IDs.
 * Returns null if the token is missing, malformed, or the signature is wrong.
 */
export function verifyRoomQrToken(
  token: string
): { propertyId: string; roomId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    // Split into exactly 3 parts: propertyId, roomId, sig
    const firstColon = decoded.indexOf(':');
    const lastColon  = decoded.lastIndexOf(':');
    if (firstColon === lastColon || firstColon < 0) return null;

    const propertyId = decoded.slice(0, firstColon);
    const roomId     = decoded.slice(firstColon + 1, lastColon);
    const sig        = decoded.slice(lastColon + 1);

    if (!propertyId || !roomId || !sig) return null;

    const expectedSig = createHmac('sha256', getSecret())
      .update(`${propertyId}:${roomId}`)
      .digest('hex')
      .slice(0, 16);

    // Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(sig, expectedSig)) return null;

    return { propertyId, roomId };
  } catch {
    return null;
  }
}

/** Constant-time string comparison (avoids timing side-channel leaks). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return require('crypto').timingSafeEqual(bufA, bufB);
}
