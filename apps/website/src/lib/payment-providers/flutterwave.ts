import crypto from 'node:crypto';
import type { InitializePaymentRequest, InitializePaymentResponse, PaymentProvider, ProviderTransactionRecord, RefundPaymentResponse, VerifyPaymentResponse } from './index';

const API_URL = 'https://api.flutterwave.com/v3';

export class FlutterwaveProvider implements PaymentProvider {
  constructor(private readonly secretKey: string, private readonly webhookSecret?: string) {
    if (!secretKey) throw new Error('Flutterwave secret key is not configured');
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const payload = await response.json().catch(() => null) as { status?: string; message?: string; data?: T } | null;
    if (!response.ok || payload?.status === 'error') throw new Error(payload?.message || `Flutterwave request failed (${response.status})`);
    return payload?.data as T;
  }

  async initializeTransaction(request: InitializePaymentRequest): Promise<InitializePaymentResponse> {
    const data = await this.request<{ link: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        amount: request.amount,
        currency: request.currency,
        tx_ref: request.reference,
        redirect_url: request.callbackUrl,
        customer: { email: request.email },
        meta: { lodgecore_source: 'standalone_api' },
        customizations: { title: 'Room reservation payment' },
      }),
    });
    return { authorizationUrl: data.link, providerRef: request.reference };
  }

  async verifyTransaction(providerRef: string): Promise<VerifyPaymentResponse> {
    const data = await this.request<{ id: number; status: string; amount: number; currency: string }>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerRef)}`);
    return { isSuccessful: data.status === 'successful', amount: Number(data.amount), currency: data.currency, providerTransactionId: String(data.id) };
  }

  async refundTransaction(): Promise<RefundPaymentResponse> {
    return { status: 'FAILED', message: 'Flutterwave refunds require manual provider configuration and are not enabled yet.' };
  }

  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false;
    if (signature === this.webhookSecret) return true;
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('base64');
    const left = Buffer.from(expected);
    const right = Buffer.from(signature);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }

  async fetchTransactions(): Promise<ProviderTransactionRecord[]> {
    return [];
  }
}
