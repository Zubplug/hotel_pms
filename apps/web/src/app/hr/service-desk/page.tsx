'use client';

import { useEffect, useState } from 'react';

export default function HrServiceDeskPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [form, setForm] = useState({ category: 'PROFILE_UPDATE', subject: '', description: '', priority: 'MEDIUM' });
  const load = () => fetch('/api/hr/service-desk').then((r) => r.json()).then((d) => setTickets(d.tickets || []));
  useEffect(() => { void load(); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const response = await fetch('/api/hr/service-desk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    if (!response.ok) return alert((await response.json()).error || 'Unable to create ticket');
    setForm({ category: 'PROFILE_UPDATE', subject: '', description: '', priority: 'MEDIUM' });
    load();
  }
  return <main className="p-6 max-w-5xl mx-auto space-y-6 text-white"><div><h1 className="text-2xl font-bold">HR Service Desk</h1><p className="text-sm text-slate-400">Track employee requests with an auditable status history.</p></div><form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="grid md:grid-cols-3 gap-3"><select className="bg-slate-900 p-2 rounded" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>EMPLOYMENT_LETTER</option><option>SALARY_INQUIRY</option><option>LEAVE_INQUIRY</option><option>GRIEVANCE</option><option>PROFILE_UPDATE</option><option>BENEFIT</option></select><select className="bg-slate-900 p-2 rounded" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select><input required className="bg-slate-900 p-2 rounded" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}/></div><textarea required className="bg-slate-900 p-2 rounded min-h-24" placeholder="Describe the request" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/><button className="bg-teal-600 rounded px-4 py-2 w-fit">Submit request</button></form><div className="space-y-2">{tickets.map((ticket) => <article key={ticket.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4"><div className="flex justify-between gap-3"><strong>{ticket.ticketNumber} · {ticket.subject}</strong><span className="text-xs text-teal-300">{ticket.status}</span></div><p className="text-sm text-slate-400 mt-2">{ticket.description}</p><p className="text-xs text-slate-500 mt-2">{ticket.category} · {ticket.priority}</p></article>)}</div></main>;
}
