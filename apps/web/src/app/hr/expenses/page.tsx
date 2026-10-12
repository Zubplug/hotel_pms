'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Employee = { id: string; firstName?: string; lastName?: string };
type Claim = { id: string; staffName: string; category: string; amount: number | null; description: string; status: string; createdAt: string };

export default function HrExpensesPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ staffId: '', category: 'OTHER', amount: '', description: '' });

  async function load() {
    setLoading(true);
    try {
      const [claimsResponse, employeesResponse] = await Promise.all([
        fetch('/api/hr/benefits'),
        fetch('/api/hr/employees?limit=200'),
      ]);
      if (claimsResponse.ok) setClaims((await claimsResponse.json()).claims || []);
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
      const response = await fetch('/api/hr/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CREATE_CLAIM', ...form }),
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

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><FileText className="h-6 w-6 text-teal-400" />Expense Claims</h1><p className="mt-1 text-sm text-slate-400">Review and submit staff reimbursement claims.</p></div>
        <Button onClick={() => setOpen((value) => !value)} className="gap-2 bg-teal-600 text-white hover:bg-teal-500"><Plus className="h-4 w-4" />New claim</Button>
      </header>
      {open && <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 sm:grid-cols-4">
        <select required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option>OTHER</option><option>TRANSPORT</option><option>MEALS</option><option>SUPPLIES</option><option>MEDICAL</option></select>
        <input required min="0.01" type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input required placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <div className="sm:col-span-4"><Button disabled={saving} type="submit" className="bg-teal-600 hover:bg-teal-500">{saving ? 'Submitting…' : 'Submit claim'}</Button></div>
      </form>}
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase text-slate-400"><tr><th className="p-4">Employee</th><th className="p-4">Category</th><th className="p-4">Amount</th><th className="p-4">Description</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-slate-800">{loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading claims…</td></tr> : claims.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No expense claims found.</td></tr> : claims.map((claim) => <tr key={claim.id} className="text-slate-300"><td className="p-4 font-medium text-white">{claim.staffName}</td><td className="p-4">{claim.category}</td><td className="p-4">{claim.amount == null ? 'Restricted' : `₦${claim.amount.toLocaleString()}`}</td><td className="p-4">{claim.description}</td><td className="p-4">{claim.status}</td></tr>)}</tbody></table></section>
    </main>
  );
}
