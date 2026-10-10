import crypto from 'node:crypto';

const VERSION = 'v1';

function encryptionKey(): Buffer {
  const raw = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY is not configured');
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY must be 32 bytes');
  return key;
}

/** Encrypt a customer-owned gateway secret for database storage. */
export function encryptPaymentCredential(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/** Decrypt a customer-owned gateway secret only inside a server-side payment request. */
export function decryptPaymentCredential(value: string): string {
  const [version, ivText, tagText, ciphertextText] = value.split('.');
  if (version !== VERSION || !ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted payment credential');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
}
