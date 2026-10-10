import prisma from '@hotel-pms/db';
import { decryptPaymentCredential } from './credentials';

/** Resolve a configured environment-variable reference without ever storing a secret. */
export function resolveSecretRef(ref: string | null | undefined, fallbackName: string): string {
  const name = ref?.trim() || fallbackName;
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    throw new Error('Invalid payment secret reference');
  }
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function getPaystackBookingAccount(propertyId: string) {
  return prisma.bookingPaymentAccount.findFirst({
    where: { propertyId, provider: 'PAYSTACK', isActive: true },
    select: { secretRef: true, webhookSecretRef: true, mode: true },
  });
}

export async function getBookingPaymentAccount(propertyId: string) {
  const account = await prisma.bookingPaymentAccount.findFirst({
    where: { propertyId, isActive: true },
    select: {
      provider: true,
      mode: true,
      publicKey: true,
      secretRef: true,
      webhookSecretRef: true,
      secretCiphertext: true,
      webhookSecretCiphertext: true,
    },
  });
  if (!account) return null;
  return {
    ...account,
    secret: account.secretCiphertext ? decryptPaymentCredential(account.secretCiphertext) : null,
    webhookSecret: account.webhookSecretCiphertext ? decryptPaymentCredential(account.webhookSecretCiphertext) : null,
  };
}
