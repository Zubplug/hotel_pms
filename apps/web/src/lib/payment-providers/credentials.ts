import crypto from 'node:crypto';

function key(): Buffer {
  const raw = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY is not configured');
  const value = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (value.length !== 32) throw new Error('PAYMENT_CREDENTIALS_ENCRYPTION_KEY must be 32 bytes');
  return value;
}

export function decryptPaymentCredential(value: string): string {
  const [version, ivText, tagText, ciphertextText] = value.split('.');
  if (version !== 'v1' || !ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted payment credential');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
}

export function encryptPaymentCredential(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}
