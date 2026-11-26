/**
 * LodgeCore Food Commerce — Public API Client
 *
 * All calls go to the LodgeCore cloud API (apps/web) via the public
 * storefront endpoint: /api/commerce/storefront/[slug]/…
 *
 * This file is intentionally NOT prefixed with 'use client' — it is
 * safe to call from both Server Components and client-side fetch wrappers.
 *
 * The slug for Stanzel Grand Resort is set via NEXT_PUBLIC_COMMERCE_SLUG
 * so it can also be used safely in client components.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://pms.zubplug.com.ng';

export const COMMERCE_SLUG =
  process.env.NEXT_PUBLIC_COMMERCE_SLUG ?? 'stanzel-grand';

function storefront(path: string) {
  return `${API_BASE}/api/commerce/storefront/${COMMERCE_SLUG}${path}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommerceStore {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  currency: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  minimumOrderAmount: number;
  status: string;
}

export interface CommerceProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  calories?: number | null;
  prepTimeMinutes: number | null;
  isAvailable: boolean;
  modifierGroups: CommerceModifierGroup[];
}

export interface CommerceModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  options: CommerceModifierOption[];
}

export interface CommerceModifierOption {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
}

export interface CommerceCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  products: CommerceProduct[];
}

export interface CommerceMenu {
  id: string;
  name: string;
  categories: CommerceCategory[];
}

export interface PlaceOrderRequest {
  customer: { name: string; phone: string; email?: string; consentToWhatsapp?: boolean };
  orderType: 'PICKUP' | 'DELIVERY';
  fulfillmentType?: 'NOW' | 'SCHEDULED';
  deliveryAddress?: { street: string; city: string; state?: string; notes?: string };
  items: { productId: string; quantity: number; modifierOptionIds?: string[]; specialNote?: string }[];
  promotionCode?: string;
  idempotencyKey: string;
  specialInstructions?: string;
}

export interface PlaceOrderResponse {
  orderRef: string;
  trackingToken: string;
  status: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  nextStep: string;
}

export interface OrderTrackStatus {
  orderRef: string;
  status: string;
  orderType: string;
  items: { productName: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  currency: string;
  statusHistory: { status: string; timestamp: string }[];
  estimatedReadyAt: string | null;
  createdAt: string;
}

export interface PaymentInitResponse {
  checkoutUrl: string;
  providerReference: string;
  amount: number;
  currency: string;
}

export interface PromoValidation {
  valid: boolean;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  finalTotal: number;
  message?: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getStorefront(): Promise<CommerceStore> {
  const res = await fetch(storefront(''), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to load store');
  const json = await res.json();
  return json.data;
}

export async function getMenu(): Promise<CommerceMenu[]> {
  const res = await fetch(storefront('/menu'), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error('Failed to load menu');
  const json = await res.json();
  return json.data;
}

export async function placeOrder(body: PlaceOrderRequest): Promise<PlaceOrderResponse> {
  const res = await fetch(storefront('/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': body.idempotencyKey },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Failed to place order');
  return json.data;
}

export async function trackOrder(orderRef: string, token: string): Promise<OrderTrackStatus> {
  const res = await fetch(storefront(`/orders/${orderRef}/track?token=${token}`), {
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Order not found');
  return json.data;
}

export async function initiatePayment(body: {
  orderRef: string;
  trackingToken: string;
  callbackUrl: string;
}): Promise<PaymentInitResponse> {
  const res = await fetch(storefront('/payment/initiate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Payment initiation failed');
  return json.data;
}

export async function validatePromo(body: {
  code: string;
  orderSubtotal: number;
}): Promise<PromoValidation> {
  const res = await fetch(storefront('/promotions/validate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) return { valid: false, discountType: 'NONE', discountValue: 0, discountAmount: 0, finalTotal: body.orderSubtotal, message: json.message };
  return json.data;
}
