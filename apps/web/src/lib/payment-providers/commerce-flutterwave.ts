/**
 * Commerce-specific Flutterwave provider.
 *
 * The existing FlutterwaveProvider (lib/payment-providers/flutterwave.ts) only
 * implements refundTransaction, which is all hotel-side code needs.
 *
 * Commerce needs initializeTransaction as well.
 * Rather than modifying the shared provider (which would affect payroll/billing),
 * we extend it here for Commerce-specific use only.
 *
 * Uses the same Flutterwave v3 API and response shape.
 */

const API_URL = 'https://api.flutterwave.com/v3';

export interface CommerceFlutterwaveInitRequest {
  txRef: string;
  amount: number;
  currency: string;
  callbackUrl: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  storeName: string;
  meta?: Record<string, unknown>;
}

export class CommerceFlutterwaveProvider {
  constructor(private readonly secretKey: string) {
    if (!secretKey) throw new Error('Flutterwave secret key is not configured');
  }

  async initializeTransaction(req: CommerceFlutterwaveInitRequest): Promise<{ checkoutUrl: string }> {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: req.txRef,
        amount: req.amount,
        currency: req.currency,
        redirect_url: req.callbackUrl,
        customer: {
          email: req.customerEmail,
          name: req.customerName,
          phonenumber: req.customerPhone,
        },
        customizations: { title: req.storeName },
        meta: req.meta ?? {},
      }),
    });

    const payload = await response.json().catch(() => null) as {
      status?: string;
      message?: string;
      data?: { link?: string };
    } | null;

    if (!response.ok || payload?.status !== 'success') {
      throw new Error(payload?.message ?? `Flutterwave payment init failed (${response.status})`);
    }

    if (!payload.data?.link) {
      throw new Error('Flutterwave did not return a checkout URL');
    }

    return { checkoutUrl: payload.data.link };
  }
}
