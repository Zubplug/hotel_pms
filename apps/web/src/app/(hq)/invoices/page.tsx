import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

export default async function HQInvoicesPage() {
  await requireHQAdmin();
  const invoices = await prisma.billingInvoice.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { organization: { select: { name: true, slug: true } } },
  });
  return <div className="p-8 space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Global Invoices</h1><p className="text-zinc-500 mt-1">Authoritative invoice records received from Stripe.</p></div>
    <Card className="overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-zinc-50 dark:bg-zinc-900 border-b"><tr><th className="px-6 py-4">Tenant</th><th className="px-6 py-4">Invoice</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Total</th><th className="px-6 py-4">Created</th><th className="px-6 py-4">Link</th></tr></thead><tbody className="divide-y">{invoices.map((invoice) => <tr key={invoice.id}><td className="px-6 py-4">{invoice.organization.name}<div className="text-xs text-zinc-500">{invoice.organization.slug}</div></td><td className="px-6 py-4 font-mono text-xs">{invoice.stripeInvoiceId}</td><td className="px-6 py-4">{invoice.status}</td><td className="px-6 py-4">{new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency.toUpperCase() }).format(invoice.total / 100)}</td><td className="px-6 py-4 text-zinc-500">{format(invoice.createdAt, 'MMM d, yyyy')}</td><td className="px-6 py-4">{invoice.hostedInvoiceUrl ? <a className="text-blue-600" href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">Open</a> : '—'}</td></tr>)}</tbody></table>{invoices.length === 0 && <p className="p-8 text-zinc-500">No Stripe invoices received yet.</p>}</Card>
  </div>;
}
