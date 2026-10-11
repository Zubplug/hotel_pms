import type { RefundPaymentResponse } from './index';

const API_URL = 'https://api.flutterwave.com/v3';

export class FlutterwaveProvider {
  constructor(private readonly secretKey: string) {
    if (!secretKey) throw new Error('Flutterwave secret key is not configured');
  }

  async refundTransaction(providerTransactionId: string, amount: number, _currency: string, reason: string): Promise<RefundPaymentResponse> {
    const response = await fetch(`${API_URL}/transactions/${encodeURIComponent(providerTransactionId)}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(amount), comments: reason }),
    });
    const payload = await response.json().catch(() => null) as { status?: string; message?: string; data?: { id?: number; flw_ref?: string; status?: string } } | null;
    if (!response.ok || payload?.status === 'error') throw new Error(payload?.message || `Flutterwave refund failed (${response.status})`);
    const status = String(payload?.data?.status || '').toLowerCase();
    const completed = ['completed-bank-transfer', 'completed-momo', 'completed-mpgs', 'completed-offline', 'completed-preauth', 'successful', 'succeeded'].includes(status);
    const failed = ['failed', 'cancelled', 'canceled'].includes(status);
    return {
      status: completed ? 'COMPLETED' : failed ? 'FAILED' : 'PROCESSING',
      providerRefundId: payload?.data?.flw_ref || (payload?.data?.id == null ? undefined : String(payload.data.id)),
      message: `Flutterwave refund ${status || 'initiated'}`,
    };
  }
}
