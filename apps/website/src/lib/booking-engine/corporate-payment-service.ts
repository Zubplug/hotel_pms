import crypto from 'node:crypto';
import { FlutterwaveProvider } from '@/lib/payment-providers/flutterwave';
import { PaystackProvider } from '@/lib/payment-providers/paystack';
import { getBookingPaymentAccount, resolveSecretRef } from '@/lib/payment-providers/booking-account';

export class CorporatePaymentInitializationError extends Error {
  constructor(readonly code: 'INVALID_AMOUNT' | 'ALREADY_PAID' | 'PAYMENT_PENDING' | 'NO_PAYMENT_ACCOUNT' | 'PROVIDER_ERROR', message: string) { super(message); }
}

export async function initializeCorporateAdvanceGatewayPayment(db: any, input: {
  organizationId: string;
  propertyId: string;
  corporateAccountId: string;
  idempotencyKey: string;
  email: string;
  amount: number;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'A positive wallet credit amount is required');
  const corporateAccount = await db.corporateAccount.findFirst({
    where: { id: input.corporateAccountId, organizationId: input.organizationId, propertyId: input.propertyId, isActive: true },
    select: { id: true, cityLedgerAccountId: true, cityLedgerAccount: { select: { status: true, currency: true } } },
  });
  if (!corporateAccount?.cityLedgerAccountId || corporateAccount.cityLedgerAccount.status !== 'ACTIVE') throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'The corporate City Ledger account is unavailable');
  const existing = await db.bookingPaymentTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    const metadata = (existing.metadata as any) || {};
    if (metadata.walletCredit === true && metadata.corporateAccountId === input.corporateAccountId && metadata.authorizationUrl) return { providerRef: existing.providerRef, authorizationUrl: metadata.authorizationUrl, amount: Number(existing.amount), currency: existing.currency, idempotent: true };
    throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'Idempotency key is already in use');
  }
  const account = await getBookingPaymentAccount(input.propertyId, 'STANDALONE_API');
  if (!account) throw new CorporatePaymentInitializationError('NO_PAYMENT_ACCOUNT', 'No payment account is configured for this property');
  const providerRef = `CORP-WALLET-${corporateAccount.id.slice(0, 8)}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const metadata = { channel: 'CORPORATE_API', paymentMode: 'WALLET_CREDIT', paymentTarget: 'STANDALONE_API', walletCredit: true, corporateAccountId: corporateAccount.id };
  const transaction = await db.bookingPaymentTransaction.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, provider: account.provider, providerRef, amount: input.amount, currency: corporateAccount.cityLedgerAccount.currency, status: 'PENDING', idempotencyKey: input.idempotencyKey, metadata } });
  try {
    const secret = account.secret ?? resolveSecretRef(account.secretRef, account.provider === 'FLUTTERWAVE' ? 'FLW_SECRET_KEY' : 'PAYSTACK_SECRET_KEY');
    const provider = account.provider === 'FLUTTERWAVE' ? new FlutterwaveProvider(secret, account.webhookSecret ?? resolveSecretRef(account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH')) : new PaystackProvider(secret);
    const callbackUrl = process.env.CORPORATE_API_PAYMENT_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL || ''}/corporate/payment/return`;
    const initialized = await provider.initializeTransaction({ amount: input.amount, currency: corporateAccount.cityLedgerAccount.currency, email: input.email, reference: providerRef, callbackUrl });
    await db.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { metadata: { ...metadata, authorizationUrl: initialized.authorizationUrl } } });
    return { providerRef, authorizationUrl: initialized.authorizationUrl, amount: input.amount, currency: corporateAccount.cityLedgerAccount.currency, idempotent: false };
  } catch (error: any) {
    await db.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED', metadata: { ...metadata, error: error?.message || 'provider initialization failed' } } });
    throw new CorporatePaymentInitializationError('PROVIDER_ERROR', 'Failed to initialize payment with provider');
  }
}

export async function initializeCorporateInvoiceGatewayPayment(db: any, input: {
  organizationId: string;
  propertyId: string;
  corporateAccountId: string;
  invoice: any;
  idempotencyKey: string;
  email?: string;
  amount?: number;
}) {
  const invoice = input.invoice;
  if (!invoice || invoice.propertyId !== input.propertyId || invoice.accountId == null || invoice.status === 'VOID') throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'Corporate invoice is not payable');
  const outstanding = Number(invoice.outstandingAmount);
  if (!Number.isFinite(outstanding) || outstanding <= 0.01 || invoice.status === 'PAID') throw new CorporatePaymentInitializationError('ALREADY_PAID', 'The corporate invoice has already been paid');
  const amount = input.amount ?? outstanding;
  if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding + 0.01) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'Payment amount exceeds the invoice balance');
  const email = input.email;
  if (!email) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'A payment email is required');

  const existing = await db.bookingPaymentTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.cityLedgerInvoiceId !== invoice.id) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'Idempotency key is already in use');
    const metadata = (existing.metadata as any) || {};
    if (metadata.authorizationUrl) return { providerRef: existing.providerRef, authorizationUrl: metadata.authorizationUrl, amount: Number(existing.amount), currency: existing.currency, idempotent: true };
    throw new CorporatePaymentInitializationError('PAYMENT_PENDING', 'A payment is already being initialized');
  }

  const pending = await db.bookingPaymentTransaction.findFirst({ where: { cityLedgerInvoiceId: invoice.id, status: 'PENDING' } });
  if (pending) throw new CorporatePaymentInitializationError('PAYMENT_PENDING', 'A payment is already awaiting confirmation');
  const account = await getBookingPaymentAccount(input.propertyId, 'STANDALONE_API');
  if (!account) throw new CorporatePaymentInitializationError('NO_PAYMENT_ACCOUNT', 'No payment account is configured for this property');
  const providerRef = `CORP-INV-${invoice.id.slice(0, 8)}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const metadata = { channel: 'CORPORATE_API', paymentMode: 'INVOICE', paymentTarget: 'STANDALONE_API', invoicePayment: true, corporateAccountId: input.corporateAccountId };
  const transaction = await db.bookingPaymentTransaction.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, cityLedgerInvoiceId: invoice.id, provider: account.provider, providerRef, amount, currency: invoice.currency, status: 'PENDING', idempotencyKey: input.idempotencyKey, metadata } });
  try {
    const secret = account.secret ?? resolveSecretRef(account.secretRef, account.provider === 'FLUTTERWAVE' ? 'FLW_SECRET_KEY' : 'PAYSTACK_SECRET_KEY');
    const provider = account.provider === 'FLUTTERWAVE' ? new FlutterwaveProvider(secret, account.webhookSecret ?? resolveSecretRef(account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH')) : new PaystackProvider(secret);
    const callbackUrl = process.env.CORPORATE_API_PAYMENT_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL || ''}/corporate/payment/return`;
    const initialized = await provider.initializeTransaction({ amount, currency: invoice.currency, email, reference: providerRef, callbackUrl });
    await db.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { metadata: { ...metadata, authorizationUrl: initialized.authorizationUrl } } });
    return { providerRef, authorizationUrl: initialized.authorizationUrl, amount, currency: invoice.currency, idempotent: false };
  } catch (error: any) {
    await db.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED', metadata: { ...metadata, error: error?.message || 'provider initialization failed' } } });
    throw new CorporatePaymentInitializationError('PROVIDER_ERROR', 'Failed to initialize payment with provider');
  }
}

export async function initializeCorporateGatewayPayment(db: any, input: {
  organizationId: string;
  reservation: any;
  idempotencyKey: string;
  email?: string;
  amount?: number;
}) {
  const reservation = input.reservation;
  const snapshot = (reservation.ratePlanSnapshot || {}) as any;
  const mode = String(snapshot.paymentMode || snapshot.request?.paymentMode || '').toUpperCase();
  if (!['FULL', 'DEPOSIT'].includes(mode)) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'This reservation does not require advance payment');
  const link = await db.corporatePaymentGroupReservation.findUnique({ where: { reservationId: reservation.id }, include: { group: true } });
  const group = link?.group ?? null;
  const requiredAmount = group ? Number(group.requiredAmount) : (mode === 'DEPOSIT' ? Number(snapshot.depositAmount ?? snapshot.pricing?.depositAmount ?? 0) : Number(snapshot.total ?? snapshot.totals?.total ?? 0));
  const settled = await db.bookingPaymentTransaction.aggregate({ where: group ? { corporatePaymentGroupId: group.id, status: 'SUCCESS' } : { reservationId: reservation.id, status: 'SUCCESS' }, _sum: { amount: true } });
  const remaining = Math.max(0, requiredAmount - Number(settled._sum.amount ?? 0));
  if (!Number.isFinite(remaining) || remaining <= 0) throw new CorporatePaymentInitializationError('ALREADY_PAID', 'The required corporate payment has already been received');
  const amount = input.amount ?? remaining;
  if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.01) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'Payment amount exceeds the remaining required amount');
  const email = input.email || reservation.primaryGuest?.email;
  if (!email) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'A payment email is required');

  const existing = await db.bookingPaymentTransaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.reservationId !== reservation.id) throw new CorporatePaymentInitializationError('INVALID_AMOUNT', 'Idempotency key is already in use');
    const metadata = (existing.metadata as any) || {};
    if (metadata.authorizationUrl) return { providerRef: existing.providerRef, authorizationUrl: metadata.authorizationUrl, amount: Number(existing.amount), currency: existing.currency, idempotent: true, expiresAt: reservation.paymentExpiresAt };
    throw new CorporatePaymentInitializationError('PAYMENT_PENDING', 'Payment is already being initialized');
  }
  const pending = await db.bookingPaymentTransaction.findFirst({ where: group ? { corporatePaymentGroupId: group.id, status: 'PENDING' } : { reservationId: reservation.id, status: 'PENDING' } });
  if (pending) throw new CorporatePaymentInitializationError('PAYMENT_PENDING', 'A payment is already awaiting confirmation');

  const account = await getBookingPaymentAccount(reservation.propertyId, 'STANDALONE_API');
  if (!account) throw new CorporatePaymentInitializationError('NO_PAYMENT_ACCOUNT', 'No payment account is configured for this property');
  const providerRef = `CORP-${reservation.id.slice(0, 8)}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const metadata = { channel: 'CORPORATE_API', paymentMode: mode, paymentTarget: 'STANDALONE_API', corporatePaymentGroupId: group?.id ?? null };
  const transaction = await db.bookingPaymentTransaction.create({ data: { organizationId: input.organizationId, propertyId: reservation.propertyId, reservationId: reservation.id, corporatePaymentGroupId: group?.id ?? null, provider: account.provider, providerRef, amount, currency: reservation.currency, status: 'PENDING', idempotencyKey: input.idempotencyKey, metadata } });
  try {
    const secret = account.secret ?? resolveSecretRef(account.secretRef, account.provider === 'FLUTTERWAVE' ? 'FLW_SECRET_KEY' : 'PAYSTACK_SECRET_KEY');
    const provider = account.provider === 'FLUTTERWAVE' ? new FlutterwaveProvider(secret, account.webhookSecret ?? resolveSecretRef(account.webhookSecretRef, 'FLW_WEBHOOK_SECRET_HASH')) : new PaystackProvider(secret);
    const callbackUrl = process.env.CORPORATE_API_PAYMENT_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL || ''}/corporate/payment/return`;
    const initialized = await provider.initializeTransaction({ amount, currency: reservation.currency, email, reference: providerRef, callbackUrl });
    await db.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { metadata: { ...metadata, authorizationUrl: initialized.authorizationUrl } } });
    return { providerRef, authorizationUrl: initialized.authorizationUrl, amount, currency: reservation.currency, expiresAt: reservation.paymentExpiresAt, idempotent: false };
  } catch (error: any) {
    await db.bookingPaymentTransaction.update({ where: { id: transaction.id }, data: { status: 'FAILED', metadata: { ...metadata, error: error?.message || 'provider initialization failed' } } });
    throw new CorporatePaymentInitializationError('PROVIDER_ERROR', 'Failed to initialize payment with provider');
  }
}
