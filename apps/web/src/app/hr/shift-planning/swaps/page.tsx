'use client';

import { useEffect, useState } from 'react';

export default function ShiftSwapsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = () => fetch('/api/hr/shifts/swaps').then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load shift swaps');
    setRows(data.swaps || []);
  }).catch((cause) => setError(cause.message));
  useEffect(() => { void load(); }, []);

  async function action(id: string, body: Record<string, string>) {
    const response = await fetch('/api/hr/shifts/swaps', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Unable to update swap'); else await load();
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-6 text-white">
    <div><h1 className="text-2xl font-bold">Shift Swap Acknowledgement</h1><p className="mt-1 text-sm text-slate-400">Employees request and accept swaps from their self-service portal. HR acknowledges accepted requests and applies the final roster change.</p></div>
    {error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}
    <div className="grid gap-3">{rows.map((x) => <article key={x.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex justify-between gap-3"><strong>{x.requesterStaff?.firstName} {x.requesterStaff?.lastName} → {x.targetStaff?.firstName} {x.targetStaff?.lastName}</strong><span className="text-xs text-amber-300">{x.status}</span></div><p className="mt-2 text-sm text-slate-400">{new Date(x.requesterDate).toLocaleDateString()} ↔ {new Date(x.targetDate).toLocaleDateString()} · {x.reason}</p><div className="mt-3 flex gap-3 text-xs">{x.status === 'PENDING_SUPERVISOR' && <><button className="text-teal-300" onClick={() => action(x.id, { status: 'APPROVED' })}>Acknowledge &amp; apply</button><button className="text-rose-300" onClick={() => action(x.id, { status: 'REJECTED', rejectionReason: 'HR did not acknowledge the requested swap' })}>Reject</button></>}</div></article>)}{rows.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">No shift swap requests awaiting HR acknowledgement.</p>}</div>
  </main>;
}
