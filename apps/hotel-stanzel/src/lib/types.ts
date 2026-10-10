/**
 * Verified LodgeCore Standalone API types
 * Derived from source-level audit of apps/website/src/app/api/v1/public/*
 * Do not assume — these shapes match the actual route implementations.
 */

// ── /rooms ────────────────────────────────────────────────────
export interface LCRoomType {
  id: string;
  name: string;
  description: string | null;
  maxOccupancy: number;
  baseRate: number | string; // Prisma Decimal → JSON serialised as string or number
  currency: string;
  photos: string[];
  amenities: string[];
}

export interface RoomsResponse {
  data: LCRoomType[];
}

// ── /availability ─────────────────────────────────────────────
export interface LCRatePricing {
  ratePlanId: string;
  ratePlanName: string;
  nights: number;
  currency: string;
  subtotal: number;
  depositAmount: number;
  depositType: string | null;
  avgNightlyRate: number;
}

export interface LCAvailableRoomType {
  roomTypeId: string;
  name: string;
  description: string | null;
  maxOccupancy: number;
  photos: string[];
  amenities: string[];
  availability: {
    available: number;
    isAvailable: boolean;
  };
  rates: LCRatePricing[];
}

export interface AvailabilityResponse {
  data: LCAvailableRoomType[];
  checkIn: string;
  checkOut: string;
  nights: number;
  occupancy: { adults: number; children: number };
}

// ── /hold ─────────────────────────────────────────────────────
export interface HoldRequest {
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
}

export interface HoldResponse {
  holdToken: string;
  expiresAt: string; // ISO 8601 — use this, not a hard-coded countdown
  expiresInSeconds: number;
  pricing: {
    nights: number;
    currency: string;
    subtotal: number;
    depositAmount: number;
    depositType: string | null;
  };
}

// ── /reservations ─────────────────────────────────────────────
export interface ReservationGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
}

export interface ReservationRequest {
  holdToken: string;
  guest: ReservationGuest;
  adults?: number;
  children?: number;
  specialRequests?: string;
}

export interface ReservationResponse {
  confirmationNumber: string;
  roomNumber?: string;
  /** CONFIRMED if paymentMode=PAY_LATER, PENDING if payment required */
  status: 'CONFIRMED' | 'PENDING';
  confirmationToken: string;
  cancellationToken: string;
  priceChanged: boolean;
  paymentRequired: boolean;
  depositAmount: number;
}

// ── /payment/intent ───────────────────────────────────────────
export interface PaymentIntentRequest {
  reservationToken: string; // = confirmationToken from ReservationResponse
  guestEmail: string;
}

export interface PaymentIntentResponse {
  providerRef: string;
  authorizationUrl: string; // Redirect guest here for Paystack payment
  amount: number;
  currency: string;
}

// ── /cancel ───────────────────────────────────────────────────
export interface CancelRequest {
  cancelToken: string; // = cancellationToken from ReservationResponse
  reason?: string;
}

export interface RefundRequestSummary {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface CancelResponse {
  cancelled: boolean;
  confirmationNumber: string;
  penaltyAmount: number;
  penaltyDescription: string;
  refundRequestsQueued: RefundRequestSummary[];
  refundNote: string;
}

// ── API error ─────────────────────────────────────────────────
export interface LCError {
  error: string;
  message?: string;
  details?: unknown;
}

// ── Availability query params ─────────────────────────────────
export interface AvailabilityQuery {
  checkIn: string;
  checkOut: string;
  ratePlanId?: string;
  adults?: number;
  children?: number;
}
