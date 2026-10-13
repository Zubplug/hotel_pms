'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, FileText, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Employee = { id: string; firstName?: string; lastName?: string };
type Claim = { id: string; claimNumber: string; staffName: string; category: string; amount: number | null; description: string; status: string; createdAt: string; rejectionReason?: string | null };
type BankAccount = { id: string; name: string; balance: number };

export default function HrExpensesPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ staffId: '', category: 'OTHER', amount: '', description: '' });
  const [role, setRole] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [paymentClaim, setPaymentClaim] = useState<Claim | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [bankAccountId, setBankAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [busyId, setBusyId] = useState('');
  const [autoBankEnabled, setAutoBankEnabled] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [claimsResponse, employeesResponse] = await Promise.all([
        fetch('/api/hr/expense-reimbursements'),
        fetch('/api/hr/employees?limit=200'),
      ]);
      if (claimsResponse.ok) { const body = await claimsResponse.json(); setClaims(body.claims || []); setRole(body.role || ''); setBankAccounts(body.bankAccounts || []); setAutoBankEnabled(Boolean(body.autoBankReimbursementEnabled)); }
      if (employeesResponse.ok) setEmployees((await employeesResponse.json()).employees || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/hr/expense-reimbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to submit claim');
      setForm({ staffId: '', category: 'OTHER', amount: '', description: '' });
      setOpen(false);
      await load();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to submit claim');
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Reason for rejection') : undefined;
    if (action === 'reject' && !reason?.trim()) return;
    setBusyId(id);
    try {
      const response = await fetch('/api/hr/expense-reimbursements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, reason }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to update claim');
      await load();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to update claim'); } finally { setBusyId(''); }
  }

  async function pay() {
    if (!paymentClaim) return;
    setBusyId(paymentClaim.id);
    try {
      const response = await fetch('/api/hr/expense-reimbursements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: paymentClaim.id, action: 'pay', method: paymentMethod, bankAccountId: paymentMethod === 'BANK_TRANSFER' ? bankAccountId : undefined, paymentReference: paymentReference || undefined }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Unable to pay reimbursement');
      setPaymentClaim(null); setPaymentReference(''); setBankAccountId(''); setPaymentMethod('CASH'); await load();
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to pay reimbursement'); } finally { setBusyId(''); }
  }

  async function toggleAutoBank() {
    const enabled = !autoBankEnabled;
    const response = await fetch('/api/hr/expense-reimbursements', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'SET_AUTO_BANK', enabled }) });
    if (!response.ok) { window.alert((await response.json()).error || 'Unable to update automatic bank reimbursement'); return; }
    setAutoBankEnabled(enabled);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><FileText className="h-6 w-6 text-teal-400" />Employee reimbursements</h1><p className="mt-1 text-sm text-slate-400">Maker-checker review: HR → Accounting → General Manager → General Cashier.</p></div>
        {['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role) && <Button onClick={() => void toggleAutoBank()} variant="outline" className={`text-xs ${autoBankEnabled ? 'border-emerald-400/40 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>{autoBankEnabled ? 'Auto bank reimbursement enabled' : 'Enable auto bank reimbursement'}</Button>}
        <Button onClick={() => setOpen((value) => !value)} className="gap-2 bg-teal-600 text-white hover:bg-teal-500"><Plus className="h-4 w-4" />New claim</Button>
      </header>
      {open && <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:grid-cols-4">
        <select required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option>OTHER</option><option>TRANSPORT</option><option>MEALS</option><option>SUPPLIES</option><option>MEDICAL</option></select>
        <input required min="0.01" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <div className="sm:col-span-4"><Button disabled={saving} type="submit" className="bg-teal-600 hover:bg-teal-500">{saving ? 'Submitting…' : 'Submit claim'}</Button></div>
      </form>}
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400"><tr><th className="p-4">Employee</th><th className="p-4">Category</th><th className="p-4">Amount</th><th className="p-4">Description</th><th className="p-4">Status</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y divide-slate-800">{loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading claims…</td></tr> : claims.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">No expense claims found.</td></tr> : claims.map((claim) => { const canAct = ((role === 'HR_MANAGER' || role === 'HR_OFFICER' || role === 'ADMIN') && claim.status === 'HR_REVIEW') || (['ACCOUNTANT', 'FINANCE_MANAGER'].includes(role) && claim.status === 'ACCOUNTANT_REVIEW'); const canPay = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'].includes(role) && claim.status === 'APPROVED_FOR_PAYMENT'; return <tr key={claim.id} className="text-slate-300"><td className="p-4 font-medium text-white">{claim.staffName}<span className="block text-[10px] text-slate-600">{claim.claimNumber}</span></td><td className="p-4">{claim.category}</td><td className="p-4">{claim.amount == null ? 'Restricted' : `₦${claim.amount.toLocaleString()}`}</td><td className="max-w-xs p-4">{claim.description}</td><td className="p-4"><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300">{claim.status.replaceAll('_', ' ')}</span></td><td className="p-4">{canAct && <div className="flex gap-2"><Button size="sm" disabled={busyId === claim.id} onClick={() => void act(claim.id, 'approve')} className="gap-1 bg-emerald-600 text-xs hover:bg-emerald-500"><Check className="h-3 w-3" />Approve</Button><Button size="sm" disabled={busyId === claim.id} onClick={() => void act(claim.id, 'reject')} variant="outline" className="gap-1 border-rose-400/30 text-xs text-rose-300"><X className="h-3 w-3" />Reject</Button></div>}{canPay && <Button size="sm" disabled={busyId === claim.id} onClick={() => setPaymentClaim(claim)} className="bg-teal-600 text-xs hover:bg-teal-500">Pay from cashier</Button>}</td></tr>; })}</tbody></table></section>
      {paymentClaim && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-[#0b1624] p-6"><div><h2 className="font-bold text-white">Pay {paymentClaim.claimNumber}</h2><p className="mt-1 text-xs text-slate-500">Choose the approved disbursement method. The payment will create the GL entry.</p></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPaymentMethod('CASH')} className={`rounded-xl border p-3 text-left text-sm ${paymentMethod === 'CASH' ? 'border-teal-400/40 bg-teal-400/10 text-teal-200' : 'border-slate-700 text-slate-400'}`}>Cash<span className="mt-1 block text-[10px] text-slate-500">General Cashier safe</span></button><button type="button" onClick={() => setPaymentMethod('BANK_TRANSFER')} className={`rounded-xl border p-3 text-left text-sm ${paymentMethod === 'BANK_TRANSFER' ? 'border-teal-400/40 bg-teal-400/10 text-teal-200' : 'border-slate-700 text-slate-400'}`}>Bank transfer<span className="mt-1 block text-[10px] text-slate-500">Configured bank account</span></button></div>{paymentMethod === 'BANK_TRANSFER' && <><select value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white"><option value="">Select bank account</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · ₦{account.balance.toLocaleString()}</option>)}</select><Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Bank transfer reference" className="border-slate-700 bg-slate-950 text-slate-100" /></>}<div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><Button variant="outline" onClick={() => setPaymentClaim(null)} className="!border-slate-700 !bg-slate-900 text-xs !text-slate-100">Cancel</Button><Button disabled={busyId === paymentClaim.id || (paymentMethod === 'BANK_TRANSFER' && (!bankAccountId || !paymentReference.trim()))} onClick={() => void pay()} className="bg-teal-600 text-white hover:bg-teal-500">Confirm payment</Button></div></div></div>}
    </main>
  );
}
