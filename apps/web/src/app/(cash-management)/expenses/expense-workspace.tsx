'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, ReceiptText, CheckCircle2, XCircle, WalletCards } from 'lucide-react';

type Expense = { id: string; expenseReference: string; status: string; amount: number; currency: string; category: string; description: string; payee: string; receiptUrl?: string | null; costCenter?: string | null; createdAt: string };

const statusStyles: Record<string, string> = { PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200', APPROVED: 'bg-blue-50 text-blue-700 border-blue-200', PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200', REJECTED: 'bg-rose-50 text-rose-700 border-rose-200' };

export function ExpenseWorkspace({ propertyId, expenses, role }: { propertyId: string; expenses: Expense[]; role: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<'success' | 'error' | ''>('');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [form, setForm] = useState({ amount: '', category: '', description: '', payee: '', receiptUrl: '', costCenter: '' });
  const canCreate = Boolean(propertyId) && (role === 'GENERAL_CASHIER' || role === 'SUPER_ADMIN');
  const canApprove = ['MANAGER', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CEO', 'SUPER_ADMIN'].includes(role);

  const create = async () => {
    setBusy(true); setMessage(''); setFeedback('');
    try {
      const response = await fetch('/api/v1/financial-control/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, ...form }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to create expense');
      setForm({ amount: '', category: '', description: '', payee: '', receiptUrl: '', costCenter: '' }); setShowForm(false); setMessage('Expense submitted for approval.'); setFeedback('success'); router.refresh();
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
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><WalletCards className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-slate-900">Controlled cash expenses</p><p className="text-xs text-slate-600">Paid only from the General Cashier Safe after approval.</p></div></div>
      {canCreate && <Button onClick={() => setShowForm(value => !value)} className="gap-2"><Plus className="h-4 w-4" />New expense</Button>}
    </div>
    {message && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${feedback === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message}</div>}
    {showForm && <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-semibold text-slate-900">Record expense</h2><p className="text-xs text-slate-500">The expense will enter approval before any cash leaves the safe.</p></div><div className="grid gap-3 md:grid-cols-2"><Input placeholder="Amount" type="number" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /><Input placeholder="Expense category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /><Input placeholder="Payee / vendor" value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} /><Input placeholder="Cost center (optional)" value={form.costCenter} onChange={e => setForm({ ...form, costCenter: e.target.value })} /><Textarea className="md:col-span-2" placeholder="Description and business purpose" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /><Input className="md:col-span-2" placeholder="Receipt URL (optional)" value={form.receiptUrl} onChange={e => setForm({ ...form, receiptUrl: e.target.value })} /></div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button><Button disabled={busy} onClick={create}>{busy ? 'Submitting…' : 'Submit for approval'}</Button></div></div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-4"><ReceiptText className="h-4 w-4 text-slate-500" /><span className="text-sm font-semibold text-slate-700">Expense register</span><span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">{expenses.length}</span></div>{expenses.length === 0 ? <div className="px-6 py-16 text-center text-sm text-slate-400">No expenses have been recorded.</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-100 bg-slate-50/70"><tr>{['Reference', 'Payee / purpose', 'Category', 'Amount', 'Status', 'Action'].map(header => <th key={header} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{expenses.map(expense => <tr key={expense.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-mono text-xs font-semibold text-slate-800">{expense.expenseReference}</p><p className="mt-1 text-xs text-slate-400">{new Date(expense.createdAt).toLocaleDateString('en-GB')}</p></td><td className="px-5 py-4"><p className="font-semibold text-slate-800">{expense.payee}</p><p className="max-w-xs truncate text-xs text-slate-500">{expense.description}</p></td><td className="px-5 py-4 text-slate-600">{expense.category}</td><td className="px-5 py-4 font-semibold text-slate-800">₦{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="px-5 py-4"><span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusStyles[expense.status] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{expense.status.replace(/_/g, ' ')}</span></td><td className="px-5 py-4"><div className="flex items-center gap-2">{canApprove && expense.status === 'PENDING_APPROVAL' && <><Button size="sm" variant="outline" disabled={busy} onClick={() => action(expense.id, 'approve')}><CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />Approve</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejecting(expense.id); setRejectionReason(''); }}><XCircle className="mr-1 h-3.5 w-3.5 text-rose-600" />Reject</Button></>}{canCreate && expense.status === 'APPROVED' && <Button size="sm" disabled={busy} onClick={() => action(expense.id, 'pay')}>Pay expense</Button>}</div></td></tr>)}</tbody></table></div>}</div>
    <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && !busy && setRejecting(null)}><DialogContent><DialogHeader><DialogTitle>Reject expense</DialogTitle><DialogDescription>Provide a reason for returning this expense.</DialogDescription></DialogHeader><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Rejection reason" /><DialogFooter><Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="destructive" disabled={busy || !rejectionReason.trim()} onClick={() => rejecting && action(rejecting, 'reject', rejectionReason)}>Reject expense</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
