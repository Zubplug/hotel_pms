'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmountInput } from '@/components/ui/amount-input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ReceiptText, CheckCircle2, XCircle, WalletCards, Loader2, BarChart3, Clock3, CircleDollarSign, ListChecks, Search, ShieldCheck } from 'lucide-react';

type Expense = { id: string; expenseReference: string; status: string; amount: number; currency: string; category: string; description: string; payee: string; receiptUrl?: string | null; costCenter?: string | null; createdAt: string };
type Option = { id: string; code: string; name: string };

const statusStyles: Record<string, string> = { PENDING_APPROVAL: 'bg-amber-400/10 text-amber-300 border-amber-400/20', APPROVED: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20', PAID: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20', REJECTED: 'bg-rose-400/10 text-rose-300 border-rose-400/20' };

export function ExpenseWorkspace({ propertyId, expenses, categories, costCenters, role }: { propertyId: string; expenses: Expense[]; categories: Option[]; costCenters: Option[]; role: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<'success' | 'error' | ''>('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [form, setForm] = useState({ amount: '', categoryId: '', description: '', payee: '', receiptUrl: '', costCenterId: '' });
  const canCreate = Boolean(propertyId) && (role === 'GENERAL_CASHIER' || role === 'SUPER_ADMIN');
  const canApprove = ['MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN'].includes(role);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const pendingExpenses = expenses.filter(expense => expense.status === 'PENDING_APPROVAL');
  const approvedExpenses = expenses.filter(expense => expense.status === 'APPROVED');
  const paidExpenses = expenses.filter(expense => expense.status === 'PAID');
  const pendingAmount = pendingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const paidAmount = paidExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categoryTotals = expenses.reduce<Record<string, number>>((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amount;
    return totals;
  }, {});
  const topCategories = Object.entries(categoryTotals).sort(([, amountA], [, amountB]) => amountB - amountA).slice(0, 4);
  const categoryMax = Math.max(...topCategories.map(([, amount]) => amount), 1);
  const averageExpense = expenses.length ? expenses.reduce((sum, expense) => sum + expense.amount, 0) / expenses.length : 0;
  const approvalRate = expenses.length ? Math.round(((approvedExpenses.length + paidExpenses.length) / expenses.length) * 100) : 0;
  const visibleExpenses = expenses.filter(expense => {
    const haystack = `${expense.expenseReference} ${expense.payee} ${expense.description} ${expense.category}`.toLowerCase();
    return (statusFilter === 'ALL' || expense.status === statusFilter) && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  });

  const create = async () => {
    setBusy(true); setMessage(''); setFeedback('');
    try {
      const response = await fetch('/api/v1/financial-control/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, ...form }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to create expense');
      setForm({ amount: '', categoryId: '', description: '', payee: '', receiptUrl: '', costCenterId: '' }); setShowForm(false); setMessage('Expense submitted for approval.'); setFeedback('success'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create expense'); setFeedback('error'); } finally { setBusy(false); }
  };

  const action = async (id: string, actionName: string, reason?: string) => {
    setBusy(true); setMessage(''); setFeedback('');
    try {
      const response = await fetch(`/api/v1/financial-control/expenses/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: actionName, reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update expense');
      setMessage(actionName === 'approve' ? 'Expense approved.' : actionName === 'pay' ? 'Expense paid from the General Cashier Safe.' : 'Expense rejected.'); setFeedback('success'); setRejecting(null); setRejectionReason(''); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update expense'); setFeedback('error'); } finally { setBusy(false); }
  };

  return <>
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-indigo-400/20 bg-indigo-400/[.08] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-400/15 text-indigo-300"><WalletCards className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-white">Controlled cash expenses</p><p className="mt-1 text-xs text-slate-400">Every payout is approved, documented, and paid from the General Cashier Safe.</p></div></div>
      {canCreate && <Button onClick={() => setShowForm(true)} className="gap-2 rounded-xl"><Plus className="h-4 w-4" />New expense</Button>}
    </div>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Pending approval', value: pendingExpenses.length, detail: `₦${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} awaiting decision`, icon: Clock3, tone: 'bg-amber-400/10 text-amber-300' },
        { label: 'Approved to pay', value: approvedExpenses.length, detail: 'Ready for cashier payment', icon: ShieldCheck, tone: 'bg-cyan-400/10 text-cyan-300' },
        { label: 'Paid expenses', value: paidExpenses.length, detail: `₦${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} disbursed`, icon: CircleDollarSign, tone: 'bg-emerald-400/10 text-emerald-300' },
        { label: 'Total register', value: expenses.length, detail: 'Controlled expense records', icon: ListChecks, tone: 'bg-indigo-400/10 text-indigo-300' },
      ].map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[.045] p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{card.label}</p><p className="mt-2 text-2xl font-black text-white">{card.value}</p><p className="mt-1 text-xs text-slate-500">{card.detail}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" /></span></div></div>; })}
    </div>
    <div className="mb-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-white/10 bg-white/[.045] p-6 shadow-sm">
        <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-300"><BarChart3 className="h-4 w-4" />Disbursement intelligence</div><h2 className="mt-1 text-lg font-semibold text-white">Where safe cash is going</h2><p className="mt-1 text-sm text-slate-400">Live expense value by configured category.</p></div><CircleDollarSign className="h-5 w-5 text-emerald-300" /></div>
        {topCategories.length === 0 ? <div className="flex h-32 items-center justify-center text-sm text-slate-500">No expense activity recorded.</div> : <div className="mt-6 space-y-4">{topCategories.map(([category, amount], index) => <div key={category}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium text-slate-300">{category}</span><span className="font-semibold text-slate-200">₦{amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[.08]"><div className={`h-full rounded-full ${index === 0 ? 'bg-indigo-400' : index === 1 ? 'bg-cyan-400' : index === 2 ? 'bg-amber-400' : 'bg-slate-400'}`} style={{ width: `${Math.min((amount / categoryMax) * 100, 100)}%` }} /></div></div>)}</div>}
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#101b2f] p-6 text-white shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300"><ShieldCheck className="h-4 w-4" />Control posture</div><h2 className="mt-2 text-lg font-semibold">Approval and payout health</h2><div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-xl bg-white/[.06] px-4 py-3"><span className="text-sm text-slate-300">Average expense</span><span className="font-bold text-white">₦{averageExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div><div className="flex items-center justify-between rounded-xl bg-white/[.06] px-4 py-3"><span className="text-sm text-slate-300">Approved or paid</span><span className="font-bold text-emerald-300">{approvalRate}%</span></div><div className="flex items-center justify-between rounded-xl bg-white/[.06] px-4 py-3"><span className="text-sm text-slate-300">Cash awaiting decision</span><span className="font-bold text-amber-300">₦{pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div></div></section>
    </div>
    {message && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${feedback === 'success' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>{message}</div>}

    <Dialog open={showForm} onOpenChange={(open) => !busy && setShowForm(open)}>
        <DialogContent className="border-white/10 bg-[#101b2f] text-slate-100 sm:max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-white"><ReceiptText className="h-5 w-5 text-indigo-300" />New cash expense</DialogTitle><DialogDescription className="text-slate-400">Submit a controlled expense for approval. No cash leaves the General Cashier Safe until it is approved.</DialogDescription></DialogHeader>
        {categories.length === 0 ? <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">No active expense categories are configured for this property. Ask an accountant or super admin to configure them first.</div> : <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium text-slate-300">Amount</label><AmountInput autoFocus min="0.01" placeholder="0.00" value={form.amount} onValueChange={amount => setForm({ ...form, amount })} className="border-white/10 bg-white/[.05] text-white placeholder:text-slate-500" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-slate-300">Expense category</label><select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="h-10 w-full rounded-lg border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="">Select configured category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-slate-300">Payee / vendor</label><Input placeholder="Who was paid?" value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} className="border-white/10 bg-white/[.05] text-white placeholder:text-slate-500" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-slate-300">Cost centre <span className="font-normal text-slate-500">(optional)</span></label><select value={form.costCenterId} onChange={e => setForm({ ...form, costCenterId: e.target.value })} className="h-10 w-full rounded-lg border border-white/10 bg-[#101b2f] px-3 text-sm text-white"><option value="">No cost centre</option>{costCenters.map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></div>
          <div className="space-y-1.5 md:col-span-2"><label className="text-sm font-medium text-slate-300">Business purpose</label><Textarea placeholder="Explain why this expense is required" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="border-white/10 bg-white/[.05] text-white placeholder:text-slate-500" /></div>
          <div className="space-y-1.5 md:col-span-2"><label className="text-sm font-medium text-slate-300">Receipt reference <span className="font-normal text-slate-500">(optional)</span></label><Input placeholder="Receipt number or secure receipt URL" value={form.receiptUrl} onChange={e => setForm({ ...form, receiptUrl: e.target.value })} className="border-white/10 bg-white/[.05] text-white placeholder:text-slate-500" /></div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setShowForm(false)} disabled={busy}>Cancel</Button><Button disabled={busy || categories.length === 0 || !form.amount || !form.categoryId || !form.description || !form.payee} onClick={create}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Submitting…' : 'Submit for approval'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.045] shadow-sm"><div className="flex flex-col gap-4 border-b border-white/10 bg-white/[.03] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-slate-400" /><span className="text-sm font-semibold text-slate-200">Expense register</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-slate-300">{visibleExpenses.length}</span></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search expenses" className="h-9 rounded-xl border-white/10 bg-white/[.05] pl-9 text-xs text-white placeholder:text-slate-500" /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-9 rounded-xl border border-white/10 bg-[#101b2f] px-3 text-xs font-medium text-slate-300"><option value="ALL">All statuses</option><option value="PENDING_APPROVAL">Pending approval</option><option value="APPROVED">Approved</option><option value="PAID">Paid</option><option value="REJECTED">Rejected</option></select></div></div>{visibleExpenses.length === 0 ? <div className="px-6 py-16 text-center text-sm text-slate-400">No expenses match the current view.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-white/10 bg-white/[.03]"><tr>{['Reference', 'Payee / purpose', 'Category', 'Amount', 'Status', 'Action'].map(header => <th key={header} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">{header}</th>)}</tr></thead><tbody className="divide-y divide-white/[.06]">{visibleExpenses.map(expense => <tr key={expense.id} className="hover:bg-white/[.04]"><td className="px-5 py-4"><p className="font-mono text-xs font-semibold text-slate-200">{expense.expenseReference}</p><p className="mt-1 text-xs text-slate-500">{new Date(expense.createdAt).toLocaleDateString('en-GB')}</p></td><td className="px-5 py-4"><p className="font-semibold text-slate-200">{expense.payee}</p><p className="max-w-xs truncate text-xs text-slate-500">{expense.description}</p></td><td className="px-5 py-4 text-slate-300">{expense.category}{expense.costCenter ? <span className="block text-xs text-slate-500">{expense.costCenter}</span> : null}</td><td className="px-5 py-4 font-semibold text-slate-200">₦{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="px-5 py-4"><span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusStyles[expense.status] || 'border-white/10 bg-white/10 text-slate-300'}`}>{expense.status.replace(/_/g, ' ')}</span></td><td className="px-5 py-4"><div className="flex items-center gap-2">{canApprove && expense.status === 'PENDING_APPROVAL' && <><Button size="sm" variant="outline" disabled={busy} onClick={() => action(expense.id, 'approve')}><CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-400" />Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejecting(expense.id); setRejectionReason(''); }}><XCircle className="mr-1 h-3.5 w-3.5 text-rose-400" />Reject</Button></>}{canCreate && expense.status === 'APPROVED' && <Button size="sm" disabled={busy} onClick={() => action(expense.id, 'pay')}>Pay expense</Button>}</div></td></tr>)}</tbody></table></div>}</div>
    <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && !busy && setRejecting(null)}><DialogContent className="border-white/10 bg-[#101b2f] text-slate-100"><DialogHeader><DialogTitle className="text-white">Reject expense</DialogTitle><DialogDescription className="text-slate-400">Provide a reason for returning this expense.</DialogDescription></DialogHeader><Textarea className="border-white/10 bg-white/[.05] text-white placeholder:text-slate-500" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Rejection reason" /><DialogFooter><Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="destructive" disabled={busy || !rejectionReason.trim()} onClick={() => rejecting && action(rejecting, 'reject', rejectionReason)}>Reject expense</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
