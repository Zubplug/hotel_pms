'use client';
import { useEffect, useState } from 'react';
export default function ShiftSwapsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => fetch('/api/hr/shifts/swaps').then((r) => r.json()).then((d) => setRows(d.swaps || []));
  useEffect(() => { void load(); }, []);
  async function review(id: string, status: string) { const r = await fetch('/api/hr/shifts/swaps', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) }); if (!r.ok) alert((await r.json()).error || 'Unable to review'); else load(); }
  return <main className="p-6 max-w-5xl mx-auto space-y-6 text-white"><h1 className="text-2xl font-bold">Shift Swap Requests</h1><div className="grid gap-3">{rows.map((x) => <article key={x.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950"><div className="flex justify-between"><strong>{x.requesterStaff?.firstName} {x.requesterStaff?.lastName} → {x.targetStaff?.firstName} {x.targetStaff?.lastName}</strong><span>{x.status}</span></div><p className="text-sm text-slate-400">{new Date(x.requesterDate).toLocaleDateString()} ↔ {new Date(x.targetDate).toLocaleDateString()} · {x.reason}</p>{x.status === 'PENDING_SUPERVISOR' && <div className="flex gap-3 mt-3"><button className="text-teal-400" onClick={() => review(x.id, 'APPROVED')}>Approve and swap rosters</button><button className="text-red-400" onClick={() => review(x.id, 'REJECTED')}>Reject</button></div>}</article>)}</div></main>;
}
