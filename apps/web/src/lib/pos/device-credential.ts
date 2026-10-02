import crypto from 'crypto';
import { compare } from 'bcryptjs';

/** Supports credentials issued by both legacy SHA-256 provisioning and newer bcrypt registration. */
export async function verifyDeviceCredential(plainText: string, storedHash: string): Promise<boolean> {
  if (!plainText || !storedHash) return false;
  const legacyHash = crypto.createHash('sha256').update(plainText).digest('hex');
  if (legacyHash.length === storedHash.length
    && crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(storedHash))) return true;
  try { return await compare(plainText, storedHash); } catch { return false; }
}
