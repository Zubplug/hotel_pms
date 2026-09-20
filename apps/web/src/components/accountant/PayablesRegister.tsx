'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, Search } from 'lucide-react';
import { PayablesInvoiceActions } from '@/components/accountant/PayablesInvoiceActions';

export type PayablesRow = {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  supplierId: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  outstandingAmount: number;
  currency: string;
  status: string;
  daysPastDue: number;
  hasGrn: boolean;
};

const statusStyles: Record<string, string> = {
  RECEIVED: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  UNDER_REVIEW: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  APPROVED: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  PARTIAL: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
  PAID: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  DISPUTED: 'border-rose-400/20 bg-rose-400/10 text-rose-300',
  CANCELLED: 'border-slate-400/20 bg-slate-400/10 text-slate-400',
};

const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(value));

export function PayablesRegister({ rows, currency }: { rows: PayablesRow[]; currency: string }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const filtered = useMemo(() => rows.filter(row => {
    const matchesStatus = status === 'ALL' || row.status === status;
    const needle = query.trim().toLowerCase();
    return matchesStatus && (!needle || `${row.invoiceNumber} ${row.supplierName}`.toLowerCase().includes(needle));
  }), [query, rows, status]);

  return <section id="invoice-register" className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#111a2b]/75 shadow-[0_18px_50px_rgba(0,0,0,.1)]"><div className="flex flex-col justify-between gap-4 border-b border-white/[.07] p-5 xl:flex-row xl:items-center"><div><h2 className="flex items-center gap-2 font-semibold text-white"><FileText className="h-4 w-4 text-emerald-300" />Invoice register</h2><p className="mt-1 text-xs text-slate-500">{filtered.length} of {rows.length} supplier invoices · every action writes to the live subledger.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-600" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search invoice or supplier" className="h-9 w-full rounded-lg border border-white/10 bg-white/[.04] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/50 sm:w-64" /></div><select value={status} onChange={event => setStatus(event.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#111a2b] px-3 text-xs text-slate-300 outline-none focus:border-emerald-400/50"><option value="ALL">All statuses</option>{['RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'PARTIAL', 'PAID', 'DISPUTED', 'CANCELLED'].map(item => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="bg-slate-950/35 text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3">Due</th><th className="px-5 py-3 text-right">Gross</th><th className="px-5 py-3 text-right">Outstanding</th><th className="px-5 py-3">Control state</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-white/[.07]">{filtered.length ? filtered.map(row => <tr key={row.id} className="align-top transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="font-medium text-slate-200">{row.invoiceNumber}</div><div className="mt-1 text-xs text-slate-600">Issued {formatDate(row.invoiceDate)}</div></td><td className="px-5 py-4"><div className="font-medium text-slate-200">{row.supplierName}</div><div className="mt-1 text-xs text-slate-600">{row.hasGrn ? 'GRN matched' : 'Manual invoice'}</div></td><td className={`px-5 py-4 ${row.daysPastDue > 0 && row.outstandingAmount > 0 ? 'text-rose-300' : 'text-slate-400'}`}><div>{formatDate(row.dueDate)}</div>{row.daysPastDue > 0 && row.outstandingAmount > 0 && <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider">{row.daysPastDue}d overdue</div>}</td><td className="px-5 py-4 text-right text-slate-400">{formatMoney(row.totalAmount, row.currency || currency)}</td><td className="px-5 py-4 text-right font-semibold text-white">{formatMoney(row.outstandingAmount, row.currency || currency)}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusStyles[row.status] || 'border-white/10 bg-white/5 text-slate-400'}`}>{row.status === 'PAID' ? <CheckCircle2 className="h-3 w-3" /> : row.daysPastDue > 0 && row.outstandingAmount > 0 ? <AlertCircle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{row.status.replaceAll('_', ' ')}</span></td><td className="px-5 py-4"><PayablesInvoiceActions invoiceId={row.id} status={row.status} amount={row.outstandingAmount} currency={row.currency || currency} /></td></tr>) : <tr><td colSpan={7} className="p-16 text-center"><FileText className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-3 text-sm text-slate-400">No supplier invoices match this view.</p></td></tr>}</tbody></table></div><div className="flex flex-col justify-between gap-2 border-t border-white/[.07] px-5 py-3 text-xs text-slate-600 sm:flex-row"><span>Live register · {rows.length} total invoices</span><span>Amounts are sourced from SupplierInvoice outstanding balances</span></div></section>;
}
