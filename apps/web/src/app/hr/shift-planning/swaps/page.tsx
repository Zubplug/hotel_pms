'use client';

import { useEffect, useState } from 'react';

export default function ShiftSwapsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [form, setForm] = useState({ requesterStaffId: '', targetStaffId: '', requesterDate: '', targetDate: '', reason: '' });
  const [error, setError] = useState('');

  const load = () => fetch('/api/hr/shifts/swaps').then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load shift swaps');
    setRows(data.swaps || []); setStaff(data.availableStaff || []);
  }).catch((cause) => setError(cause.message));
  useEffect(() => { void load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const response = await fetch('/api/hr/shifts/swaps', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Unable to request swap');
    setForm({ requesterStaffId: '', targetStaffId: '', requesterDate: '', targetDate: '', reason: '' }); await load();
  }

  async function action(id: string, body: Record<string, string>) {
    const response = await fetch('/api/hr/shifts/swaps', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Unable to update swap'); else await load();
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-6 text-white">
    <div><h1 className="text-2xl font-bold">Shift Swap Requests</h1><p className="mt-1 text-sm text-slate-400">Employees agree first; supervisors approve the final roster change.</p></div>
    {error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-5">
      <select required value={form.requesterStaffId} onChange={(e) => setForm({ ...form, requesterStaffId: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs"><option value="">Requester</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName} · {x.department}</option>)}</select>
      <select required value={form.targetStaffId} onChange={(e) => setForm({ ...form, targetStaffId: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs"><option value="">Swap with</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName} · {x.department}</option>)}</select>
      <input required type="date" value={form.requesterDate} onChange={(e) => setForm({ ...form, requesterDate: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs" />
      <input required type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs" />
      <input required minLength={5} placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs" />
      <button className="rounded bg-teal-700 px-3 py-2 text-xs font-semibold hover:bg-teal-600 md:col-span-5">Request swap</button>
    </form>
    <div className="grid gap-3">{rows.map((x) => <article key={x.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex justify-between gap-3"><strong>{x.requesterStaff?.firstName} {x.requesterStaff?.lastName} → {x.targetStaff?.firstName} {x.targetStaff?.lastName}</strong><span className="text-xs text-amber-300">{x.status}</span></div><p className="mt-2 text-sm text-slate-400">{new Date(x.requesterDate).toLocaleDateString()} ↔ {new Date(x.targetDate).toLocaleDateString()} · {x.reason}</p><div className="mt-3 flex gap-3 text-xs">{x.status === 'PENDING_PEER' && <><button className="text-emerald-300" onClick={() => action(x.id, { action: 'PEER_APPROVE' })}>Accept</button><button className="text-rose-300" onClick={() => action(x.id, { action: 'PEER_REJECT', reason: 'Target employee declined' })}>Decline</button></>}{x.status === 'PENDING_SUPERVISOR' && <><button className="text-teal-300" onClick={() => action(x.id, { status: 'APPROVED' })}>Approve and swap rosters</button><button className="text-rose-300" onClick={() => action(x.id, { status: 'REJECTED', rejectionReason: 'Supervisor rejected' })}>Reject</button></>}{['PENDING_PEER', 'PENDING_SUPERVISOR'].includes(x.status) && <button className="text-slate-400" onClick={() => action(x.id, { action: 'CANCEL_REQUEST' })}>Cancel</button>}</div></article>)}{rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">No shift swap requests.</p>}</div>
  </main>;
}
