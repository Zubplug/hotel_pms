'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Loader2, Plus, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Option = { id: string; code: string; name: string };
type Expense = {
  id: string; reference: string; status: string; currentApprovalStage?: string | null; amount: number; currency: string;
  category: string; description: string; payee: string; costCenter?: string | null; createdAt: string;
  approvals: { stage: string; status: string; actedAt: string | null }[];
};

const stages = ['GENERAL_CASHIER', 'ACCOUNTANT', 'GENERAL_MANAGER'];
const stageLabel = (stage?: string | null) => stage?.replaceAll('_', ' ') || 'Complete';
const statusClass = (status: string) => status === 'APPROVED' || status === 'PAID' ? 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20' : status === 'REJECTED' ? 'text-rose-300 bg-rose-400/10 border-rose-400/20' : 'text-amber-300 bg-amber-400/10 border-amber-400/20';

export function HousekeepingExpenseRequestView({ propertyName, propertyId, currency, expenses, categories, costCenters }: { propertyName: string; propertyId: string; currency: string; expenses: Expense[]; categories: Option[]; costCenters: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ amount: '', categoryId: '', payee: '', description: '', costCenterId: '', receiptUrl: '' });
  const money = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  const pending = expenses.filter(expense => !['PAID', 'REJECTED'].includes(expense.status));
  const approved = expenses.filter(expense => expense.status === 'APPROVED').length;

  const submit = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/financial-control/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, currency, ...form }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to submit request');
      setForm({ amount: '', categoryId: '', payee: '', description: '', costCenterId: '', receiptUrl: '' });
      setOpen(false); setMessage('Expense request submitted to the General Cashier approval queue.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit request'); } finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-[1360px] space-y-6 px-5 py-7 sm:px-8">
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan-300"><ReceiptText className="h-4 w-4" />Controlled department spend</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Expense requests</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Request funds for housekeeping, laundry, and maintenance operations. The request moves through three independent approvals before the General Cashier releases funds.</p><p className="mt-2 text-xs text-slate-500">{propertyName} · {currency}</p></div><Button onClick={() => setOpen(true)} className="gap-2 rounded-xl bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Plus className="h-4 w-4" />New expense request</Button></header>
    {message && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
    <section className="grid gap-4 md:grid-cols-3"><Metric label="Open requests" value={String(pending.length)} detail="Awaiting approval or release" icon={Clock3} /><Metric label="Fully approved" value={String(approved)} detail="Ready for General Cashier release" icon={ShieldCheck} /><Metric label="Approval chain" value="3 stages" detail="Cashier · Accountant · General Manager" icon={WalletCards} /></section>
    <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" /><div><p className="text-sm font-semibold text-white">Controlled release policy</p><p className="mt-1 text-xs leading-5 text-slate-400">Approval does not move money. After the General Cashier, Accountant, and General Manager approve, only the General Cashier can release the funds by cash or bank transfer. The release posts the expense to the mapped GL account.</p></div></div></section>
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.035]"><div className="border-b border-white/[.08] px-5 py-4"><h2 className="text-sm font-semibold text-white">My department requests</h2><p className="mt-1 text-xs text-slate-500">Live status and approval ownership for submitted operating expenses.</p></div>{expenses.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No expense requests yet.</div> : <div className="divide-y divide-white/[.06]">{expenses.map(expense => <article key={expense.id} className="p-5"><div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-cyan-300">{expense.reference}</span><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(expense.status)}`}>{expense.status.replaceAll('_', ' ')}</span></div><h3 className="mt-2 font-semibold text-white">{expense.payee} · {expense.category}</h3><p className="mt-1 text-sm text-slate-400">{expense.description}</p><p className="mt-2 text-xs text-slate-600">{new Date(expense.createdAt).toLocaleString('en-GB')}{expense.costCenter ? ` · ${expense.costCenter}` : ''}</p></div><p className="text-lg font-bold text-white">{money(expense.amount)}</p></div><div className="mt-5 grid gap-2 md:grid-cols-3">{stages.map(stage => { const approval = expense.approvals.find(item => item.stage === stage); const complete = approval?.status === 'APPROVED'; const rejected = approval?.status === 'REJECTED'; return <div key={stage} className={`rounded-xl border px-3 py-3 ${complete ? 'border-emerald-400/20 bg-emerald-400/[.06]' : rejected ? 'border-rose-400/20 bg-rose-400/[.06]' : expense.currentApprovalStage === stage ? 'border-amber-400/25 bg-amber-400/[.06]' : 'border-white/[.07] bg-white/[.02]'}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">{stageLabel(stage)}</span>{complete ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Clock3 className="h-4 w-4 text-slate-600" />}</div><p className="mt-1 text-[11px] text-slate-500">{complete ? 'Approved' : rejected ? 'Rejected' : expense.currentApprovalStage === stage ? 'Awaiting decision' : 'Queued'}</p></div>; })}</div>{expense.status === 'PAID' && <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-300">Released and posted to accounting <ArrowRight className="h-3.5 w-3.5" /></p>}</article>)}</div>}</section>
    <Dialog open={open} onOpenChange={value => !busy && setOpen(value)}><DialogContent className="border-white/10 bg-[#101b2f] text-slate-100 sm:max-w-2xl"><DialogHeader><DialogTitle className="text-white">New operating expense request</DialogTitle><DialogDescription className="text-slate-400">This request will be routed to the General Cashier, Accountant, and General Manager in sequence.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 md:grid-cols-2"><Field label="Amount"><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></Field><Field label="Expense category"><select value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })} className="h-10 w-full rounded-lg border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="">Select category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></Field><Field label="Payee / vendor"><Input value={form.payee} onChange={event => setForm({ ...form, payee: event.target.value })} placeholder="Who requires payment?" /></Field><Field label="Cost centre (optional)"><select value={form.costCenterId} onChange={event => setForm({ ...form, costCenterId: event.target.value })} className="h-10 w-full rounded-lg border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="">No cost centre</option>{costCenters.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></Field><Field label="Business purpose" wide><Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Explain the operational need and guest/service impact" /></Field><Field label="Receipt reference (optional)" wide><Input value={form.receiptUrl} onChange={event => setForm({ ...form, receiptUrl: event.target.value })} placeholder="Receipt number or secure document reference" /></Field></div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !form.amount || !form.categoryId || !form.payee || !form.description} onClick={submit}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit request</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Clock3 }) { return <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-300"><Icon className="h-4 w-4" /></span></div></div>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`space-y-1.5 ${wide ? 'md:col-span-2' : ''}`}><span className="text-xs font-semibold uppercase tracking-[.1em] text-slate-400">{label}</span>{children}</label>; }
