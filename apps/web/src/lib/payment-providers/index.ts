export interface InitializePaymentRequest {
  amount: number;
  currency: string;
  email: string;
  reference: string;
  callbackUrl: string;
}

export interface InitializePaymentResponse {
  authorizationUrl: string;
  providerRef: string;
}

export interface VerifyPaymentResponse {
  isSuccessful: boolean;
  amount: number;
  currency: string;
  providerTransactionId: string;
}

export interface RefundPaymentResponse {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  providerRefundId?: string;
  message?: string;
}

export interface ProviderTransactionRecord {
  providerRef: string;
  providerTransactionId: string;
  amount: number;
  currency: string;
  status: string; // e.g., 'success', 'failed', 'abandoned'
  createdAt: string;
  settledAt?: string;
}

export interface PaymentProvider {
  initializeTransaction(request: InitializePaymentRequest): Promise<InitializePaymentResponse>;
  verifyTransaction(providerRef: string): Promise<VerifyPaymentResponse>;
  refundTransaction(providerTransactionId: string, amount: number, currency: string, reason: string): Promise<RefundPaymentResponse>;
  validateWebhookSignature(payload: string, signature: string): boolean;
  fetchTransactions(startDate: Date, endDate: Date): Promise<ProviderTransactionRecord[]>;
}
