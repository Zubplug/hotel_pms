import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Encrypts a string (e.g. API Keys, OAuth tokens) using AES-256-GCM.
 * Ensure OTA_ENCRYPTION_KEY is a 32-byte (256-bit) hex string in production.
 */
export function encryptCredentials(text: string): string {
  const secretKey = process.env.OTA_ENCRYPTION_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OTA_ENCRYPTION_KEY must be set in production');
    }
    // Fallback for local dev
    return Buffer.from(text).toString('base64');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Key derivation
  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha512');
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a string encrypted by encryptCredentials.
 */
export function decryptCredentials(cipherText: string): string {
  const secretKey = process.env.OTA_ENCRYPTION_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OTA_ENCRYPTION_KEY must be set in production');
    }
    // Fallback for local dev
    return Buffer.from(cipherText, 'base64').toString('utf8');
  }

  const buffer = Buffer.from(cipherText, 'base64');
  
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha512');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
