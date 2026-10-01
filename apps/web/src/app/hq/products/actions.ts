'use server';

import prisma, { createFlutterwavePaymentPlan } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

export async function createBillingProduct(formData: FormData) {
  await requireHQAdmin();
  const code = String(formData.get('code') || '').trim().toUpperCase();
  const name = String(formData.get('name') || '').trim();
  const type = String(formData.get('type') || 'ADDON');
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(code) || !name || !['BASE', 'ADDON'].includes(type)) throw new Error('Invalid billing product');
  if (!process.env.FLW_SECRET_KEY) throw new Error('Flutterwave is not configured');
  await prisma.billingProduct.create({ data: { code, name, type } });
  revalidatePath('/hq/products');
}

export async function createBillingPrice(formData: FormData) {
  await requireHQAdmin();
  const productId = String(formData.get('productId') || '');
  const amount = Number(formData.get('amount'));
  const currency = String(formData.get('currency') || '').trim().toLowerCase();
  const interval = String(formData.get('interval') || 'month') as 'month' | 'year';
  if (!productId || !Number.isInteger(amount) || amount <= 0 || !/^[a-z]{3}$/.test(currency) || !['month', 'year'].includes(interval)) throw new Error('Invalid billing price');
  const product = await prisma.billingProduct.findUniqueOrThrow({ where: { id: productId } });
  if (!process.env.FLW_SECRET_KEY) throw new Error('Flutterwave is not configured');
  if (currency.toUpperCase() !== 'NGN') throw new Error('Flutterwave catalogue prices currently require NGN');
  const paymentPlan = await createFlutterwavePaymentPlan({ name: product.name, amount: Math.round(amount / 100), interval: interval === 'year' ? 'yearly' : 'monthly' });
  await prisma.billingPrice.create({ data: { productId, flutterwavePriceId: String(paymentPlan.id), amount, currency, interval } });
  revalidatePath('/hq/products');
}
