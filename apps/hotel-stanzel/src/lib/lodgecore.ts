// LodgeCore Standalone API — server-side client
//
// SECURITY:
// - LC_PUBLISHABLE_KEY is intentionally NOT prefixed with NEXT_PUBLIC_
//   so Next.js never bundles it into client JavaScript.
// - All functions in this file must only be called from:
//   - Server Components (pages without 'use client')
//   - Route Handlers (app/api routes)
// - They must NEVER be imported from 'use client' components.

import type {
  RoomsResponse,
  AvailabilityResponse,
  AvailabilityQuery,
  HoldRequest,
  HoldResponse,
  ReservationRequest,
  ReservationResponse,
  CancelRequest,
  CancelResponse,
  LCError,
} from './types';

const LC_API = process.env.LC_API_URL ?? 'https://lodgecore.vercel.app/api/v1/public';

function getPublishableKey(): string {
  const key = process.env.LC_PUBLISHABLE_KEY;
  if (!key || key === 'pk_live_REPLACE_ME') {
    throw new Error(
      '[LodgeCore] LC_PUBLISHABLE_KEY is not configured. ' +
      'Set it in .env.local — see .env.local.example for instructions.'
    );
  }
  return key;
}

async function lcFetch<T>(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const { idempotencyKey, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Publishable-Key': getPublishableKey(),
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  const response = await fetch(`${LC_API}${path}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const err = data as LCError;
    throw new LodgeCoreApiError(
      err.message ?? err.error ?? 'API request failed',
      response.status,
      err.error ?? 'UNKNOWN',
      err.details
    );
  }

  return data as T;
}

/** Typed API error — inspect .statusCode and .errorCode in route handlers */
export class LodgeCoreApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'LodgeCoreApiError';
  }
}

// ── Public read functions (safe to call server-side during SSR / ISR) ─────────

/**
 * Fetch all active room types for the property.
 * Response is cached for 1 hour at the CDN level (Cache-Control: s-maxage=3600).
 * Use next.revalidate in server components for additional ISR control.
 */
export async function getRoomTypes(): Promise<RoomsResponse> {
  return lcFetch<RoomsResponse>('/rooms', {
    next: { revalidate: 3600 },
  });
}

/**
 * Check availability and pricing for given dates and occupancy.
 * Response is cached for 30s (availability changes frequently).
 * Always fetch fresh in booking-critical paths — do not read stale availability.
 */
export async function getAvailability(query: AvailabilityQuery): Promise<AvailabilityResponse> {
  const params = new URLSearchParams();
  params.set('checkIn', query.checkIn);
  params.set('checkOut', query.checkOut);
  if (query.ratePlanId) params.set('ratePlanId', query.ratePlanId);
  if (query.adults != null) params.set('adults', String(query.adults));
  if (query.children != null) params.set('children', String(query.children));

  return lcFetch<AvailabilityResponse>(`/availability?${params.toString()}`, {
    next: { revalidate: 30 },
  });
}

// ── Mutating functions (only call from Route Handlers, never from GET handlers) ─

/**
 * Place an inventory hold.
 * Returns the opaque holdToken and server-assigned expiry — always use the
 * returned expiresAt rather than computing an expiry client-side.
 */
export async function createHold(body: HoldRequest): Promise<HoldResponse> {
  return lcFetch<HoldResponse>('/hold', {
    method: 'POST',
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

/**
 * Convert a hold into a reservation.
 * idempotencyKey must be unique per booking attempt and stable across retries.
 * Use crypto.randomUUID() generated on the client and sent with the form submission.
 */
export async function createReservation(
  body: ReservationRequest,
  idempotencyKey: string
): Promise<ReservationResponse> {
  return lcFetch<ReservationResponse>('/reservations', {
    method: 'POST',
    body: JSON.stringify(body),
    idempotencyKey,
    cache: 'no-store',
  });
}

/**
 * Cancel a reservation via the guest cancel token.
 * Returns penalty and refund details.
 */
export async function cancelReservation(
  body: CancelRequest,
  idempotencyKey: string
): Promise<CancelResponse> {
  return lcFetch<CancelResponse>('/cancel', {
    method: 'POST',
    body: JSON.stringify(body),
    idempotencyKey,
    cache: 'no-store',
  });
}
