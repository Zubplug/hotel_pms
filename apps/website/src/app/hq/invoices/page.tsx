import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(amount / 100);

const statusTone = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'paid') return 'bg-emerald-400/10 text-emerald-300';
  if (s === 'open' || s === 'pending') return 'bg-amber-400/10 text-amber-300';
  if (s === 'past_due' || s === 'uncollectible') return 'bg-rose-400/10 text-rose-300';
  return 'bg-slate-400/10 text-slate-400';
};

export default async function HQInvoicesPage() {
  await requireHQAdmin();
  const invoices = await prisma.billingInvoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { organization: { select: { name: true, slug: true } } },
  });

  return (
    <div className="min-h-full bg-[#07111f] p-5 text-slate-200 sm:p-8 xl:p-10">
      <div className="mx-auto max-w-[1500px] space-y-8">

        {/* Page header */}
        <header>
          <p className="text-xs font-medium uppercase tracking-[.18em] text-indigo-300">Billing records</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Global invoices</h1>
          <p className="mt-2 text-sm text-slate-400">
            Authoritative invoice records received from Stripe across all tenants.
          </p>
        </header>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#101b2f]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-[.15em] text-slate-500">
              <tr>
                <th className="px-5 py-4 font-medium">Tenant</th>
                <th className="px-5 py-4 font-medium">Invoice ID</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Total</th>
                <th className="px-5 py-4 font-medium">Amount due</th>
                <th className="px-5 py-4 font-medium">Created</th>
                <th className="px-5 py-4 text-right font-medium">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="transition hover:bg-white/[.025]">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-200">{invoice.organization.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{invoice.organization.slug}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-slate-400">{invoice.stripeInvoiceId}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone(invoice.status)}`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 tabular-nums text-slate-300">
                    {money(invoice.total, invoice.currency)}
                  </td>
                  <td className="px-5 py-4 tabular-nums text-slate-300">
                    {money(invoice.amountDue, invoice.currency)}
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {invoice.createdAt.toLocaleDateString('en-NG', { dateStyle: 'medium' })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {invoice.hostedInvoiceUrl ? (
                      <a
                        href={invoice.hostedInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.04] px-3 text-xs font-medium text-slate-200 transition hover:bg-white/[.08] hover:text-white"
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && (
            <p className="p-12 text-center text-sm text-slate-500">No Stripe invoices received yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
