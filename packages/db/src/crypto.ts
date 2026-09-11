import crypto from 'crypto';

// Use a 32-byte hex string from the environment
// Ensure this is securely set in production (e.g. openssl rand -hex 32)
const getEncryptionKey = (): Buffer => {
  const keyHex = process.env.APP_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('APP_ENCRYPTION_KEY environment variable is not set. It must be a 32-byte hex string.');
  }
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters).');
  }
  return key;
};

export interface EncryptedPayload {
  iv: string;
  content: string;
  authTag: string;
}

/**
 * Encrypts a string using AES-256-GCM.
 */
export function encrypt(text: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM standard IV size is 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    content: encrypted,
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts a payload previously encrypted with AES-256-GCM.
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const encryptedText = Buffer.from(payload.content, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
