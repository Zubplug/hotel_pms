import { encrypt } from "@hotel-pms/db";

export function encryptBeds24Credentials(credentials: { mode?: "RESELLER"; propertyId?: string; refreshToken?: string; webhookSecret: string }) {
  return JSON.stringify(encrypt(JSON.stringify(credentials)));
}
