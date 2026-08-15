import crypto from 'crypto';
import { PaymentProvider, InitializePaymentRequest, InitializePaymentResponse, VerifyPaymentResponse, RefundPaymentResponse, ProviderTransactionRecord } from './index';

export class PaystackProvider implements PaymentProvider {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
  }

  async initializeTransaction(request: InitializePaymentRequest): Promise<InitializePaymentResponse> {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100), // Paystack expects lowest denomination (e.g. kobo/cents)
        email: request.email,
        currency: request.currency,
        reference: request.reference,
        callback_url: request.callbackUrl,
      }),
    });

    const data = await response.json();
    if (!data.status) {
      throw new Error(`Paystack initialization failed: ${data.message}`);
    }

    return {
      authorizationUrl: data.data.authorization_url,
      providerRef: data.data.reference,
    };
  }

  async verifyTransaction(providerRef: string): Promise<VerifyPaymentResponse> {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(providerRef)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    const data = await response.json();
    if (!data.status) {
      throw new Error(`Paystack verification failed: ${data.message}`);
    }

    return {
      isSuccessful: data.data.status === 'success',
      amount: data.data.amount / 100, // Convert back from lowest denomination
      currency: data.data.currency,
      providerTransactionId: data.data.id.toString(),
    };
  }

  async refundTransaction(providerTransactionId: string, amount: number, currency: string, reason: string): Promise<RefundPaymentResponse> {
    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: providerTransactionId,
        amount: Math.round(amount * 100), // Lowest denomination
        merchant_note: reason
      })
    });

    const data = await response.json();
    if (!data.status) {
      // Paystack rejected the refund immediately (e.g. past time limit, insufficient funds)
      return {
        status: 'FAILED',
        message: data.message
      };
    }

    const paystackStatus = data.data.status; // e.g. "pending", "processing", "processed", "failed"
    let localStatus: 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'PROCESSING';
    
    if (paystackStatus === 'processed') {
      localStatus = 'COMPLETED';
    } else if (paystackStatus === 'failed') {
      localStatus = 'FAILED';
    }

    return {
      status: localStatus,
      providerRefundId: data.data.id ? data.data.id.toString() : undefined,
      message: data.message
    };
  }

  validateWebhookSignature(payload: string, signature: string): boolean {
    const hash = crypto.createHmac('sha512', this.secretKey).update(payload).digest('hex');
    return hash === signature;
  }

  async fetchTransactions(startDate: Date, endDate: Date): Promise<ProviderTransactionRecord[]> {
    const response = await fetch(`https://api.paystack.co/transaction?from=${startDate.toISOString()}&to=${endDate.toISOString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    const data = await response.json();
    if (!data.status) {
      throw new Error(`Failed to fetch Paystack transactions: ${data.message}`);
    }

    return data.data.map((tx: any) => ({
      providerRef: tx.reference,
      providerTransactionId: tx.id.toString(),
      amount: tx.amount / 100,
      currency: tx.currency,
      status: tx.status,
      createdAt: tx.created_at,
      settledAt: tx.paid_at // Usually represents when it succeeded/settled on their end
    }));
  }
}
