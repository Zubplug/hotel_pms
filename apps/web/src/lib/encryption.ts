import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-must-be-32-chars!!'; 
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();

  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltHex, ivHex, authTagHex, encryptedHex] = parts;

  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
