"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

type Line = { department: string; category: string; amount: string; isRevenue: boolean; notes: string };
const blank: Line = { department: 'ROOMS', category: 'ROOM_REVENUE', amount: '', isRevenue: true, notes: '' };

export function NewBudgetModal({ propertyId, currency }: { propertyId: string; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [lines, setLines] = useState<Line[]>([blank, { ...blank, department: 'FNB', category: 'FNB_COST', isRevenue: false }]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/v1/accountant/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        propertyId, name, periodStart: new Date(`${startDate}T00:00:00`).toISOString(), periodEnd: new Date(`${endDate}T00:00:00`).toISOString(),
        lines: lines.filter(line => Number(line.amount) > 0).map(line => ({ ...line, amount: Number(line.amount) }))
      }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to create budget');
      toast.success('Budget created as draft'); setOpen(false); setName(''); setLines([blank]); router.refresh();
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Unable to create budget'); }
    finally { setSaving(false); }
  }

  return <>
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3.5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"><Plus className="h-4 w-4" />New budget</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#111827] p-6 text-slate-100 shadow-2xl">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300">Planning control</p><h2 className="mt-1 text-xl font-semibold">Create a working budget</h2><p className="mt-1 text-xs text-slate-500">Create a draft with accountable revenue and expense lines.</p></div><button type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">×</button></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2 text-xs text-slate-400">Budget name<input required value={name} onChange={e => setName(e.target.value)} placeholder="FY 2027 operating budget" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50" /></label><label className="text-xs text-slate-400">Period start<input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white [color-scheme:dark]" /></label><label className="text-xs text-slate-400">Period end<input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white [color-scheme:dark]" /></label></div>
        <div className="mt-6 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Budget lines</h3><p className="text-xs text-slate-500">Amounts are entered in {currency} for the full period.</p></div><button type="button" onClick={() => setLines([...lines, blank])} className="text-xs font-semibold text-emerald-300">+ Add line</button></div>
        <div className="mt-3 space-y-2">{lines.map((line, index) => <div key={index} className="grid gap-2 rounded-xl border border-white/[.07] bg-white/[.025] p-3 sm:grid-cols-[1fr_1.2fr_110px_90px_28px]"><input value={line.department} onChange={e => setLines(lines.map((item, i) => i === index ? { ...item, department: e.target.value } : item))} placeholder="Department" className="rounded-md border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white" /><input value={line.category} onChange={e => setLines(lines.map((item, i) => i === index ? { ...item, category: e.target.value } : item))} placeholder="Category / GL group" className="rounded-md border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white" /><input required type="number" min="0" step="0.01" value={line.amount} onChange={e => setLines(lines.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} placeholder="Amount" className="rounded-md border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white" /><select value={line.isRevenue ? 'revenue' : 'expense'} onChange={e => setLines(lines.map((item, i) => i === index ? { ...item, isRevenue: e.target.value === 'revenue' } : item))} className="rounded-md border border-white/10 bg-slate-950 px-2 py-2 text-xs text-white"><option value="revenue">Revenue</option><option value="expense">Expense</option></select><button type="button" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, i) => i !== index))} className="text-slate-600 hover:text-rose-300 disabled:opacity-30"><Trash2 className="mx-auto h-4 w-4" /></button></div>)}</div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">Cancel</button><button disabled={saving} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Creating…' : 'Create draft'}</button></div>
      </form>
    </div>}
  </>;
}
