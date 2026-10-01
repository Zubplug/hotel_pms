import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { createBillingProduct, createBillingPrice } from './actions';

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);

export default async function HQProductsPage() {
  await requireHQAdmin();
  const products = await prisma.billingProduct.findMany({
    include: { prices: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-full bg-slate-950 p-5 text-slate-200 sm:p-8 xl:p-10">
      <div className="mx-auto max-w-[1500px] space-y-8">

        {/* Page header + Create product form */}
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[.18em] text-indigo-300">Billing catalogue</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Product catalog</h1>
            <p className="mt-2 text-sm text-slate-400">Manage billing products, modules, and pricing plans.</p>
          </div>
          <form action={createBillingProduct} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Code</label>
              <input
                name="code"
                required
                placeholder="ADDON_BEDS24"
                className="h-9 w-36 rounded-lg border border-white/[.06] bg-white/[.04] px-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-white/[.06]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Name</label>
              <input
                name="name"
                required
                placeholder="Product name"
                className="h-9 w-44 rounded-lg border border-white/[.06] bg-white/[.04] px-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-white/[.06]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Type</label>
              <select
                name="type"
                className="h-9 rounded-lg border border-white/[.06] bg-slate-900 px-3 text-sm text-slate-200 outline-none transition focus:border-indigo-400/50"
              >
                <option value="ADDON">ADDON</option>
                <option value="BASE">BASE</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
            >
              Create product
            </button>
          </form>
        </header>

        {/* Product cards */}
        <div className="space-y-5">
          {products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-white/[.06] bg-slate-900 p-5">
              {/* Product header */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-white">{product.name}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    product.type === 'BASE' ? 'bg-indigo-400/10 text-indigo-300' : 'bg-sky-400/10 text-sky-300'
                  }`}>
                    {product.type}
                  </span>
                  {!product.active && (
                    <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-[11px] font-medium text-rose-300">
                      INACTIVE
                    </span>
                  )}
                </div>
                <span className="rounded-md bg-white/[.04] px-2.5 py-1 font-mono text-xs text-slate-400">
                  {product.code}
                </span>
              </div>

              {/* Prices */}
              <p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Prices</p>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {product.prices.map((price) => (
                  <div key={price.id} className="rounded-xl border border-white/8 bg-white/[.025] p-4">
                    <p className="text-xl font-semibold tracking-tight text-white">
                      {money(price.amount, price.currency)}
                      <span className="ml-1 text-sm font-normal text-slate-500">/ {price.interval}</span>
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-slate-500 break-all">
                      Stripe: {price.stripePriceId}
                    </p>
                  </div>
                ))}
                {product.prices.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-white/[.06] p-6 text-center text-sm text-slate-600">
                    No prices configured
                  </div>
                )}
              </div>

              {/* Add price form */}
              <form action={createBillingPrice} className="flex flex-wrap items-end gap-2 border-t border-white/8 pt-4">
                <input type="hidden" name="productId" value={product.id} />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Amount (cents)</label>
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    required
                    placeholder="9900"
                    className="h-9 w-28 rounded-lg border border-white/[.06] bg-white/[.04] px-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-indigo-400/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Currency</label>
                  <input
                    name="currency"
                    defaultValue="usd"
                    maxLength={3}
                    required
                    className="h-9 w-20 rounded-lg border border-white/[.06] bg-white/[.04] px-3 text-sm uppercase text-slate-200 outline-none transition focus:border-indigo-400/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Interval</label>
                  <select
                    name="interval"
                    className="h-9 rounded-lg border border-white/[.06] bg-slate-900 px-3 text-sm text-slate-200 outline-none transition focus:border-indigo-400/50"
                  >
                    <option value="month">month</option>
                    <option value="year">year</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="h-9 rounded-lg border border-white/[.06] bg-white/[.04] px-4 text-sm font-medium text-slate-200 transition hover:bg-white/[.08] hover:text-white"
                >
                  Add Stripe price
                </button>
              </form>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[.06] p-16 text-center">
            <p className="text-sm text-slate-500">No billing products configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
