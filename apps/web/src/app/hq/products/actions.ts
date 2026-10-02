'use server';

import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

type ActionResult = { ok: true } | { ok: false; error: string };

function actionError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return 'A catalogue record with these details already exists.';
  return error instanceof Error ? error.message : 'The catalogue action could not be completed.';
}

export async function createBillingProduct(formData: FormData): Promise<ActionResult> {
  try {
    await requireHQAdmin();
    const code = String(formData.get('code') || '').trim().toUpperCase();
    const name = String(formData.get('name') || '').trim();
    const type = String(formData.get('type') || 'ADDON');
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(code) || !name || !['BASE', 'ADDON'].includes(type)) throw new Error('Invalid billing product');
    if (code === 'ADDON_SMART_ACCESS' || code === 'SMART_ACCESS') {
      throw new Error('Smart Access is included in MODULE_PMS and cannot be sold as a separate product.');
    }
    await prisma.billingProduct.create({ data: { code, name, type } });
    revalidatePath('/hq/products');
    return { ok: true };
  } catch (error) {
    console.error('[HQ products] product save failed', error);
    return { ok: false, error: actionError(error) };
  }
}

export async function createBillingPrice(formData: FormData): Promise<ActionResult> {
  try {
    await requireHQAdmin();
    const productId = String(formData.get('productId') || '');
    const amountMajor = Number(formData.get('amount'));
    const currency = String(formData.get('currency') || '').trim().toLowerCase();
    const interval = String(formData.get('interval') || 'month') as 'month' | 'year';
    if (!productId || !Number.isFinite(amountMajor) || amountMajor <= 0 || !Number.isInteger(amountMajor) || !/^[a-z]{3}$/.test(currency) || !['month', 'year'].includes(interval)) throw new Error('Enter a valid whole-currency amount, such as 50000 for ₦50,000.');
    const amount = amountMajor * 100;
    const product = await prisma.billingProduct.findUniqueOrThrow({ where: { id: productId }, select: { active: true, code: true, catalogVersion: true } });
    if (!product.active) throw new Error('Prices can only be added to active catalogue products.');
    if (product.code === 'ADDON_SMART_ACCESS' || product.code === 'SMART_ACCESS') {
      throw new Error('Smart Access is included in MODULE_PMS and cannot have a separate price.');
    }
    await prisma.billingPrice.create({ data: { productId, amount, currency, interval, catalogVersion: product.catalogVersion } });
    revalidatePath('/hq/products');
    return { ok: true };
  } catch (error) {
    console.error('[HQ products] price save failed', error);
    return { ok: false, error: actionError(error) };
  }
}
