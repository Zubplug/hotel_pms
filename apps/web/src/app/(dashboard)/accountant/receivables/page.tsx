import React from 'react';
import { AlertCircle, ArrowRightLeft, Building2, CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react';
import { redirect } from 'next/navigation';

import { NewCityLedgerInvoiceModal } from '@/components/accountant/NewCityLedgerInvoiceModal';
import { RecordCityLedgerPaymentModal } from '@/components/accountant/RecordCityLedgerPaymentModal';
import { ExportReceivablesButton } from '@/components/accountant/ExportReceivablesButton';
import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

type AgingBucket = 'CURRENT' | '31_60' | '61_90' | 'OVER_90';

const getAgingBucket = (days: number): AgingBucket => {
  if (days <= 30) return 'CURRENT';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  return 'OVER_90';
};

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

const formatDate = (date: Date | null) => date
  ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(date)
  : 'No open transfer date';

export default async function ReceivablesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Freceivables');

  const propertyId = session.user.propertyId;
  if (!propertyId) {
    return <EmptyState title="No property assigned" message="Your user account is not assigned to a property." />;
  }

  const [property, accounts, openTransfers, payments] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.cityLedgerAccount.findMany({ where: { propertyId }, orderBy: { name: 'asc' } }),
    prisma.cityLedgerEntry.findMany({
      where: { propertyId, type: 'TRANSFER_IN', status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, accountId: true, amount: true, currency: true, createdAt: true, reason: true, reference: true, invoice: { select: { invoiceNumber: true, issueDate: true, dueDate: true } } }
    }),
    prisma.cityLedgerEntry.findMany({
      where: { propertyId, type: 'PAYMENT' },
      orderBy: { createdAt: 'desc' },
      select: { accountId: true, createdAt: true }
    })
  ]);

  const currency = property?.baseCurrency || accounts[0]?.currency || 'NGN';
  const now = Date.now();
  const oldestTransferByAccount = new Map<string, typeof openTransfers[number]>();
  for (const transfer of openTransfers) {
    if (!oldestTransferByAccount.has(transfer.accountId)) oldestTransferByAccount.set(transfer.accountId, transfer);
  }
  const lastPaymentByAccount = new Map<string, Date>();
  for (const payment of payments) {
    if (!lastPaymentByAccount.has(payment.accountId)) lastPaymentByAccount.set(payment.accountId, payment.createdAt);
  }

  const accountRows = accounts
    .filter(account => Number(account.balance) > 0)
    .map(account => {
      const oldestTransfer = oldestTransferByAccount.get(account.id);
      const ageDate = oldestTransfer?.invoice?.dueDate || oldestTransfer?.createdAt;
      const daysOutstanding = ageDate
        ? Math.max(0, Math.floor((now - ageDate.getTime()) / 86_400_000))
        : 0;
      return {
        account,
        oldestTransfer,
        daysOutstanding,
        agingBucket: getAgingBucket(daysOutstanding),
        lastPayment: lastPaymentByAccount.get(account.id) || null,
      };
    });

  const aging = [
    { key: 'CURRENT' as const, label: 'Current (0–30 days)', status: 'healthy' },
    { key: '31_60' as const, label: '31–60 days', status: 'warning' },
    { key: '61_90' as const, label: '61–90 days', status: 'danger' },
    { key: 'OVER_90' as const, label: 'Over 90 days', status: 'critical' },
  ].map(bucket => {
    const rows = accountRows.filter(row => row.agingBucket === bucket.key);
    return {
      ...bucket,
      amount: rows.reduce((sum, row) => sum + Number(row.account.balance), 0),
      count: rows.length,
    };
  });

  const totalOutstanding = accountRows.reduce((sum, row) => sum + Number(row.account.balance), 0);
  const overdueAmount = aging.slice(1).reduce((sum, bucket) => sum + bucket.amount, 0);

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans text-slate-50 selection:bg-emerald-500/30 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white"><Building2 className="h-8 w-8 text-emerald-400" />Accounts Receivable</h1>
            <p className="mt-1 text-sm text-slate-400">Live city-ledger balances, corporate billing, and AR aging for {property?.name || 'this property'}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2"><ExportReceivablesButton currency={currency} rows={accountRows.map(({ account, oldestTransfer, lastPayment, daysOutstanding }) => ({ name: account.name, type: account.type, balance: Number(account.balance), oldestOpenItem: formatDate(oldestTransfer?.createdAt || null), lastPayment: formatDate(lastPayment), status: daysOutstanding > 30 ? 'OVERDUE' : 'CURRENT' }))} /><NewCityLedgerInvoiceModal accounts={accounts.filter(account => account.status === 'ACTIVE').map(account => ({ id: account.id, name: account.name }))} /></div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {aging.map(item => (
            <div key={item.key} className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <p className="mb-1 text-sm font-medium text-slate-400">{item.label}</p>
              <div className="flex items-end justify-between gap-3"><h3 className="text-2xl font-bold text-white">{formatCurrency(item.amount, currency)}</h3><span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300">{item.count} account{item.count === 1 ? '' : 's'}</span></div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-900"><div className={`h-full rounded-full ${item.status === 'healthy' ? 'bg-emerald-400' : item.status === 'warning' ? 'bg-amber-400' : item.status === 'danger' ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${totalOutstanding ? Math.max(4, Math.min(100, (item.amount / totalOutstanding) * 100)) : 0}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:flex-row md:items-center">
          <div><p className="text-sm font-medium text-slate-400">Total outstanding receivables</p><h2 className="mt-1 text-4xl font-bold text-white">{formatCurrency(totalOutstanding, currency)}</h2><p className="mt-2 text-sm text-slate-500">{accountRows.length} open account{accountRows.length === 1 ? '' : 's'} · {formatCurrency(overdueAmount, currency)} aged over 30 days</p></div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300"><TrendingUp className="mb-2 h-5 w-5" />Balances are read from the live city ledger.</div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="border-b border-white/10 p-5"><h3 className="text-lg font-semibold text-white">Open AR accounts</h3><p className="mt-1 text-sm text-slate-400">New invoices are aged from their due date. Legacy transfers without invoice metadata are aged from their posting date.</p></div>
          <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-b border-white/10 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-4 font-medium">Account</th><th className="px-6 py-4 font-medium">Type</th><th className="px-6 py-4 font-medium">Invoice / due date</th><th className="px-6 py-4 font-medium">Last payment</th><th className="px-6 py-4 font-medium">Status</th><th className="px-6 py-4 text-right font-medium">Balance</th><th className="px-6 py-4 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-white/5">{accountRows.length ? accountRows.map(({ account, oldestTransfer, lastPayment, daysOutstanding }) => <tr key={account.id} className="transition-colors hover:bg-white/[0.02]"><td className="px-6 py-4"><div className="font-medium text-white">{account.name}</div><div className="font-mono text-xs text-slate-500">{account.id.slice(0, 8)}</div></td><td className="px-6 py-4 text-slate-300">{account.type}</td><td className="px-6 py-4 text-slate-400"><div>{oldestTransfer?.invoice?.invoiceNumber || 'Legacy AR transfer'}</div><div className="text-xs text-slate-500">{oldestTransfer?.invoice ? `Due ${formatDate(oldestTransfer.invoice.dueDate)}` : formatDate(oldestTransfer?.createdAt || null)} · {daysOutstanding} day{daysOutstanding === 1 ? '' : 's'}</div></td><td className="px-6 py-4 text-slate-400">{formatDate(lastPayment)}</td><td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${daysOutstanding > 30 ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>{daysOutstanding > 30 ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{daysOutstanding > 30 ? 'OVERDUE' : 'CURRENT'}</span></td><td className="px-6 py-4 text-right font-medium text-white">{formatCurrency(Number(account.balance), account.currency || currency)}</td><td className="px-6 py-4 text-right"><RecordCityLedgerPaymentModal accountId={account.id} accountName={account.name} balance={Number(account.balance)} currency={account.currency || currency} /></td></tr>) : <tr><td colSpan={7} className="py-12 text-center text-slate-500"><Clock className="mx-auto mb-2 h-6 w-6" />No outstanding receivables found.</td></tr>}</tbody></table></div>
          <div className="border-t border-white/10 bg-slate-900/30 p-4 text-center text-sm text-slate-500">Showing {accountRows.length} open account{accountRows.length === 1 ? '' : 's'}</div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm text-indigo-200"><ArrowRightLeft className="mt-0.5 h-5 w-5 shrink-0" /><p>Use <strong>New Invoice</strong> to issue a controlled receivable with an invoice number and due date. Payments are applied oldest-due-first and update the live balance atomically.</p></div>
      </div>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-slate-300"><div><FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" /><h1 className="text-xl font-semibold text-white">{title}</h1><p className="mt-2 text-sm text-slate-400">{message}</p></div></div>;
}
