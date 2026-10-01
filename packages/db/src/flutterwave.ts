import { createHmac, timingSafeEqual } from 'node:crypto';

const API_URL = 'https://api.flutterwave.com/v3';

export type FlutterwaveCheckoutInput = {
  amount: number;
  currency: string;
  txRef: string;
  redirectUrl: string;
  customer: { email: string; name?: string; phoneNumber?: string };
  paymentPlan?: number;
  meta?: Record<string, string>;
};

function secretKey() {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) throw new Error('Flutterwave is not configured');
  return key;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => null) as { status?: string; message?: string; data?: T } | null;
  if (!response.ok || payload?.status === 'error') throw new Error(payload?.message || `Flutterwave request failed (${response.status})`);
  return payload?.data as T;
}

export async function createFlutterwaveCheckout(input: FlutterwaveCheckoutInput) {
  return request<{ link: string }>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      tx_ref: input.txRef,
      redirect_url: input.redirectUrl,
      customer: { email: input.customer.email, name: input.customer.name, phonenumber: input.customer.phoneNumber },
      payment_plan: input.paymentPlan,
      meta: input.meta,
      customizations: { title: 'LodgeCore subscription' },
    }),
  });
}

export async function createFlutterwavePaymentPlan(input: { name: string; amount: number; interval: 'monthly' | 'yearly' }) {
  return request<{ id: number; name: string; amount: number; interval: string; status: string }>('/payment-plans', { method: 'POST', body: JSON.stringify(input) });
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  return request<{ id: number; tx_ref: string; status: string; amount: number; currency: string; customer?: { email?: string }; meta?: Record<string, unknown> }>(`/transactions/${encodeURIComponent(transactionId)}/verify`);
}

export function verifyFlutterwaveWebhook(rawBody: string, signature: string | null, secretHash = process.env.FLW_WEBHOOK_SECRET_HASH) {
  if (!signature || !secretHash) return false;
  const hmac = createHmac('sha256', secretHash).update(rawBody).digest('base64');
  const left = Buffer.from(hmac);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyFlutterwaveLegacyWebhook(signature: string | null, secretHash = process.env.FLW_WEBHOOK_SECRET_HASH) {
  return Boolean(signature && secretHash && signature === secretHash);
}
