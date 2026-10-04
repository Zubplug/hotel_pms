import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

export function encryptBeds24Credentials(credentials: { refreshToken: string; webhookSecret: string }) {
  const secretKey = process.env.OTA_ENCRYPTION_KEY;
  if (!secretKey) throw new Error("OTA_ENCRYPTION_KEY is not configured");
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, "sha512");
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
