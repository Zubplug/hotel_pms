'use server';

import prisma from '@hotel-pms/db';
import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

export async function createBillingProduct(formData: FormData) {
  await requireHQAdmin();
  const code = String(formData.get('code') || '').trim().toUpperCase();
  const name = String(formData.get('name') || '').trim();
  const type = String(formData.get('type') || 'ADDON');
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(code) || !name || !['BASE', 'ADDON'].includes(type)) throw new Error('Invalid billing product');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Stripe is not configured');
  const stripeProduct = await new Stripe(stripeKey, { apiVersion: '2026-08-26.dahlia' }).products.create({ name, metadata: { code, type } });
  await prisma.billingProduct.create({ data: { code, name, type, stripeProductId: stripeProduct.id } });
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
  if (!product.stripeProductId) throw new Error('Stripe product is not configured');
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Stripe is not configured');
  const stripePrice = await new Stripe(stripeKey, { apiVersion: '2026-08-26.dahlia' }).prices.create({ product: product.stripeProductId, unit_amount: amount, currency, recurring: { interval } });
  await prisma.billingPrice.create({ data: { productId, stripePriceId: stripePrice.id, amount, currency, interval } });
  revalidatePath('/hq/products');
}
