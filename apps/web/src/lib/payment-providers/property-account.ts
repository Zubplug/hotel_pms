import prisma from '@hotel-pms/db';
import { decryptPaymentCredential } from './credentials';

/**
 * Resolve the single customer-facing payment account configured for a property.
 *
 * Booking, corporate, and Commerce payments must use the same property account.
 * Payroll accounts are deliberately excluded because they are a separate
 * operational payment flow.
 */
export async function getPropertyPaymentAccount(propertyId: string, preferredTarget = 'BOOKING_ENGINE') {
  const select = {
    provider: true,
    mode: true,
    publicKey: true,
    secretRef: true,
    webhookSecretRef: true,
    secretCiphertext: true,
    webhookSecretCiphertext: true,
    currency: true,
  } as const;

  const account = await prisma.bookingPaymentAccount.findFirst({
    where: { propertyId, isActive: true, target: preferredTarget },
    orderBy: { updatedAt: 'desc' },
    select,
  }) ?? await prisma.bookingPaymentAccount.findFirst({
    where: { propertyId, isActive: true, target: { not: 'PAYROLL' } },
    orderBy: { updatedAt: 'desc' },
    select,
  });

  if (!account) return null;

  return {
    ...account,
    secret: account.secretCiphertext ? decryptPaymentCredential(account.secretCiphertext) : null,
    webhookSecret: account.webhookSecretCiphertext ? decryptPaymentCredential(account.webhookSecretCiphertext) : null,
  };
}

export function resolvePropertySecret(
  value: string | null,
  ref: string | null,
  fallbackName: string,
): string {
  if (value) return value;
  const name = ref?.trim() || fallbackName;
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('Invalid payment secret reference');
  const resolved = process.env[name];
  if (!resolved) throw new Error(`${name} is not configured`);
  return resolved;
}
