/**
 * Commerce Order Utilities
 *
 * Shared helpers for generating order references and tracking tokens.
 * Uses Node.js crypto (already in use throughout the codebase) — NOT nanoid.
 */

import crypto from 'node:crypto';
import prisma from '@hotel-pms/db';

/**
 * Generates a human-readable order reference in the format:
 *   LC-YYYYMMDD-XXXXXX  (e.g. LC-20241126-A3F9B2)
 *
 * Uses crypto.randomBytes for the suffix — consistent with the existing
 * pattern in /api/v1/payments/online/initialize/route.ts (PAY-XXXX-hex).
 * The @unique constraint on CommerceOrder.orderRef handles collision edge cases.
 */
export async function generateOrderRef(): Promise<string> {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `LC-${dateStr}-${suffix}`;
}

/**
 * Generates a secure, opaque tracking token for public order tracking.
 * No customer login required — the token itself is the credential.
 */
export function generateTrackingToken(): string {
  return crypto.randomBytes(18).toString('hex');
}

/**
 * Generates a deterministic idempotency key for a CommerceSyncEvent.
 * The same orderId + suffix will always produce the same key,
 * making re-enqueue safe against duplicate creation (Prisma P2002 guard).
 */
export function generateOrderIdempotencyKey(orderId: string, suffix: string): string {
  return crypto.createHash('sha256').update(`${orderId}:${suffix}`).digest('hex').slice(0, 48);
}

/**
 * Checks whether a CommerceStore is ACTIVE.
 * Throws a typed error if not found or not active.
 */
export class StoreNotActiveError extends Error {
  constructor(public readonly reason: 'NOT_FOUND' | 'DRAFT' | 'SUSPENDED' | 'CLOSED') {
    super(reason);
    this.name = 'StoreNotActiveError';
  }
}

export async function assertStoreActive(slug: string) {
  const store = await prisma.commerceStore.findUnique({
    where: { slug },
    select: { id: true, status: true, organizationId: true },
  });

  if (!store) throw new StoreNotActiveError('NOT_FOUND');
  if (store.status === 'DRAFT') throw new StoreNotActiveError('DRAFT');
  if (store.status === 'SUSPENDED') throw new StoreNotActiveError('SUSPENDED');
  if (store.status === 'CLOSED') throw new StoreNotActiveError('CLOSED');

  return store;
}
