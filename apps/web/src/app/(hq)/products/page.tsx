import prisma from '@hotel-pms/db';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireHQAdmin } from '@/lib/auth/hq';
import Stripe from 'stripe';
import { revalidatePath } from 'next/cache';

export async function createBillingProduct(formData: FormData) {
  'use server';
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
  'use server';
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

export default async function HQProductsPage() {
  await requireHQAdmin();
  const products = await prisma.billingProduct.findMany({
    include: { prices: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Product Catalog</h1>
          <p className="text-zinc-500 mt-1">Manage billing products, modules, and prices.</p>
        </div>
        <form action={createBillingProduct} className="flex items-end gap-2">
          <input name="code" required placeholder="ADDON_BEDS24" className="h-10 rounded border px-2 text-sm" />
          <input name="name" required placeholder="Product name" className="h-10 rounded border px-2 text-sm" />
          <select name="type" className="h-10 rounded border px-2 text-sm"><option>ADDON</option><option>BASE</option></select>
          <Button type="submit">Create Product</Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {products.map(product => (
          <Card key={product.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>{product.name}</CardTitle>
                <Badge variant={product.type === 'BASE' ? 'default' : 'secondary'}>{product.type}</Badge>
                {!product.active && <Badge variant="destructive">INACTIVE</Badge>}
              </div>
              <div className="text-sm font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                {product.code}
              </div>
            </CardHeader>
            <CardContent>
              <h4 className="text-sm font-medium text-zinc-500 mb-4">Prices</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {product.prices.map(price => (
                  <div key={price.id} className="p-4 border rounded-lg bg-zinc-50 dark:bg-zinc-900">
                    <div className="text-xl font-bold">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currency }).format(price.amount / 100)}
                      <span className="text-sm text-zinc-500 font-normal"> / {price.interval}</span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-2 font-mono">
                      Stripe: {price.stripePriceId}
                    </div>
                  </div>
                ))}
                {product.prices.length === 0 && (
                  <div className="p-4 border border-dashed rounded-lg text-center text-zinc-500">
                    No prices configured
                  </div>
                )}
              </div>
              <form action={createBillingPrice} className="mt-5 flex flex-wrap items-end gap-2 border-t pt-4">
                <input type="hidden" name="productId" value={product.id} />
                <input name="amount" type="number" min="1" required placeholder="Amount cents" className="h-9 w-28 rounded border px-2 text-sm" />
                <input name="currency" defaultValue="usd" maxLength={3} required className="h-9 w-20 rounded border px-2 text-sm uppercase" />
                <select name="interval" className="h-9 rounded border px-2 text-sm"><option>month</option><option>year</option></select>
                <Button type="submit" variant="outline">Create Stripe Price</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
