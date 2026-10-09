import { describe, expect, it } from 'vitest';
import {
  AvailabilityQuerySchema,
  CancelReservationRequestSchema,
  CreatePaymentIntentRequestSchema,
  CreateReservationRequestSchema,
} from '../packages/types/src/public-api.schema';

describe('public API request contract', () => {
  it('requires strict reservation input and applies safe defaults', () => {
    const result = CreateReservationRequestSchema.safeParse({
      holdToken: 'hold-token',
      guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.adults).toBe(1);
  });

  it('rejects unknown reservation fields', () => {
    expect(CreateReservationRequestSchema.safeParse({
      holdToken: 'hold-token',
      guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
      amount: 1,
    }).success).toBe(false);
  });

  it('validates occupancy and ISO date query parameters', () => {
    expect(AvailabilityQuerySchema.safeParse({
      checkIn: '2026-11-01', checkOut: '2026-11-03', adults: '2', children: '1',
    }).success).toBe(true);
    expect(AvailabilityQuerySchema.safeParse({ checkIn: 'tomorrow', checkOut: '2026-11-03' }).success).toBe(false);
  });

  it('requires opaque payment and cancellation tokens', () => {
    expect(CreatePaymentIntentRequestSchema.safeParse({ reservationToken: 'short', guestEmail: 'guest@example.com' }).success).toBe(false);
    expect(CancelReservationRequestSchema.safeParse({ cancelToken: 'short' }).success).toBe(false);
  });
});
