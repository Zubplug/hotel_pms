import { z } from 'zod';

export const CreateHoldRequestSchema = z.object({
  roomTypeId: z.string().uuid('roomTypeId must be a valid UUID'),
  ratePlanId: z.string().uuid('ratePlanId must be a valid UUID'),
  checkIn:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
  checkOut:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
}).strict();

export const ReservationGuestSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  // Accept country names (for example, "Nigeria") as entered by guest forms.
  // ISO alpha-2/alpha-3 codes remain valid as well.
  country: z.string().trim().max(100).optional(),
}).strict();

export const CreateReservationRequestSchema = z.object({
  holdToken: z.string().min(1, 'Hold token is required'),
  guest: ReservationGuestSchema,
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  specialRequests: z.string().trim().max(2000).optional(),
  returnUrl: z.string().url().max(2048).optional(),
}).strict();

export const ReservationResponseSchema = z.object({
  confirmationNumber: z.string(),
  roomNumber: z.string().optional(),
  status: z.enum(['CONFIRMED', 'PENDING']),
  confirmationToken: z.string(),
  cancellationToken: z.string(),
  paymentRequired: z.boolean(),
  depositAmount: z.number().min(0),
});

export const CreatePaymentIntentRequestSchema = z.object({
  reservationToken: z.string().trim().min(32).max(512),
  guestEmail: z.string().trim().email().max(320),
  returnUrl: z.string().url().max(2048).optional(),
}).strict();

export const CancelReservationRequestSchema = z.object({
  cancelToken: z.string().trim().min(32).max(512).optional(),
  confirmationNumber: z.string().trim().min(3).max(100).optional(),
  guestEmail: z.string().trim().email().max(320).optional(),
  reason: z.string().trim().max(1000).optional(),
  preview: z.boolean().optional(),
}).strict().refine((value) => Boolean(value.cancelToken || value.confirmationNumber || value.guestEmail), { message: 'A cancellation token, confirmation number, or guest email is required' });

export const AvailabilityQuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ratePlanId: z.string().uuid().optional(),
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
}).strict();
