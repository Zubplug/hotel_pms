'use client';
import { useEffect, useState } from 'react';
export default function MissedPunchPage() {
  const [rows, setRows] = useState<any[]>([]);
  const load = () => fetch('/api/hr/attendance/missed-punch').then((r) => r.json()).then((d) => setRows(d.requests || []));
  useEffect(() => { void load(); }, []);
  async function review(id: string, status: string) { const reviewerNotes = status === 'REJECTED' ? window.prompt('Reason for rejecting this correction:') || '' : ''; const r = await fetch('/api/hr/attendance/missed-punch', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status, reviewerNotes }) }); if (!r.ok) alert((await r.json()).error || 'Unable to review'); else load(); }
  return <main className="p-6 max-w-5xl mx-auto space-y-6 text-white"><h1 className="text-2xl font-bold">Missed Punch Requests</h1><div className="grid gap-3">{rows.map((x) => <article key={x.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950"><div className="flex justify-between"><strong>{x.staff?.firstName} {x.staff?.lastName}</strong><span>{x.status}</span></div><p className="text-sm text-slate-400">{new Date(x.date).toLocaleDateString()} · {x.reason}</p>{x.status === 'PENDING' && <div className="flex gap-3 mt-3"><button className="text-teal-400" onClick={() => review(x.id, 'APPROVED')}>Approve</button><button className="text-red-400" onClick={() => review(x.id, 'REJECTED')}>Reject</button></div>}</article>)}</div></main>;
}
