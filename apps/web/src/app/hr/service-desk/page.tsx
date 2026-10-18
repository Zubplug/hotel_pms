'use client';

import { useEffect, useState } from 'react';

const RESPONSE_TEMPLATES = [
  { label: 'Request more information', text: 'Hello, please provide the additional information or supporting document required so HR can continue reviewing your request.' },
  { label: 'Acknowledgement', text: 'Your request has been received and is being reviewed by HR. We will follow up with you once the next step is complete.' },
  { label: 'Resolution follow-up', text: 'HR has completed the requested review. Please confirm that the resolution is clear and let us know if you need any further assistance.' },
];

export default function HrServiceDeskPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [internal, setInternal] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('OPEN');
  const [error, setError] = useState('');

  const load = () => fetch('/api/hr/service-desk?scope=hr').then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load HR service desk');
    setTickets(data.tickets || []);
    setCanManage(Boolean(data.canManage));
  }).catch((cause) => setError(cause.message));

  useEffect(() => { void load(); }, []);

  async function sendReply(ticketId: string) {
    if (!reply[ticketId]?.trim()) return;
    const response = await fetch('/api/hr/service-desk', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'REPLY', ticketId, body: reply[ticketId], isInternal: Boolean(internal[ticketId]) }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Unable to send reply');
    setReply({ ...reply, [ticketId]: '' });
    await load();
  }

  async function changeStatus(ticket: any, status: string) {
    const resolutionNotes = ['RESOLVED', 'CLOSED'].includes(status) ? window.prompt('Resolution or follow-up notes:') || '' : undefined;
    if (['RESOLVED', 'CLOSED'].includes(status) && resolutionNotes.trim().length < 5) return;
    const response = await fetch('/api/hr/service-desk', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ticket.id, status, resolutionNotes }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Unable to update ticket');
    await load();
  }

  const visibleTickets = tickets.filter((ticket) => filter === 'ALL' || (filter === 'OPEN' ? !['RESOLVED', 'CLOSED'].includes(ticket.status) : ticket.status === filter));

  if (!canManage && !error) return <main className="mx-auto max-w-5xl p-6 text-white"><h1 className="text-2xl font-bold">HR Service Desk</h1><p className="mt-2 text-sm text-slate-400">Loading the HR queue…</p></main>;
  if (!canManage && error) return <main className="mx-auto max-w-5xl p-6 text-white"><h1 className="text-2xl font-bold">HR Service Desk</h1><p className="mt-2 text-sm text-slate-400">This queue is for HR staff. Employees should create and follow up on requests from their employee self-service portal.</p></main>;

  return <main className="mx-auto max-w-6xl space-y-6 p-6 text-white">
    <header><h1 className="text-2xl font-bold">HR Service Desk Queue</h1><p className="mt-1 text-sm text-slate-400">View, respond to, assign, and follow up on employee requests. New requests are created from the employee self-service portal.</p></header>
    {error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="mr-2 text-xs font-semibold text-slate-400">Queue</span>{['OPEN', 'IN_PROGRESS', 'AWAITING_EMPLOYEE', 'RESOLVED', 'ALL'].map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded px-3 py-1.5 text-[11px] ${filter === value ? 'bg-teal-700 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>{value.replace('_', ' ')}</button>)}</div>
    <div className="space-y-4">{visibleTickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-mono text-teal-300">{ticket.ticketNumber}</p><h2 className="mt-1 text-base font-semibold text-white">{ticket.subject}</h2><p className="mt-1 text-xs text-slate-400">{ticket.staff?.firstName} {ticket.staff?.lastName} · {ticket.staff?.department} · {ticket.category} · Priority: {ticket.priority}</p></div><select value={ticket.status} onChange={(event) => void changeStatus(ticket, event.target.value)} className="rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white"><option>OPEN</option><option>IN_PROGRESS</option><option>AWAITING_EMPLOYEE</option><option>RESOLVED</option><option>CLOSED</option></select></div>
      <p className="mt-4 rounded-lg bg-slate-900 p-3 text-sm text-slate-300">{ticket.description}</p>
      <div className="mt-3 space-y-2">{ticket.messages?.map((message: any) => <div key={message.id} className={`rounded-lg p-3 text-sm ${message.isInternal ? 'border border-amber-800/40 bg-amber-950/20 text-amber-100' : 'bg-slate-900 text-slate-300'}`}><div className="flex justify-between gap-3 text-[10px] text-slate-500"><span>{message.isInternal ? 'Internal HR note' : 'Employee-visible reply'}</span><span>{new Date(message.createdAt).toLocaleString()}</span></div><p className="mt-1">{message.body}</p></div>)}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3"><div className="mb-2 flex flex-wrap gap-2"><select defaultValue="" onChange={(event) => { if (event.target.value) setReply({ ...reply, [ticket.id]: event.target.value }); }} className="rounded border border-slate-700 bg-slate-950 p-2 text-[11px] text-slate-300"><option value="">Insert response template…</option>{RESPONSE_TEMPLATES.map((template) => <option key={template.label} value={template.text}>{template.label}</option>)}</select><label className="flex items-center gap-2 text-[11px] text-amber-300"><input type="checkbox" checked={Boolean(internal[ticket.id])} onChange={(event) => setInternal({ ...internal, [ticket.id]: event.target.checked })} /> Internal HR note</label></div><div className="flex gap-2"><textarea className="min-h-16 min-w-0 flex-1 rounded bg-slate-950 p-2 text-sm text-white" placeholder={internal[ticket.id] ? 'Internal follow-up note, not visible to employee' : 'Reply to employee'} value={reply[ticket.id] || ''} onChange={(event) => setReply({ ...reply, [ticket.id]: event.target.value })} /><button type="button" onClick={() => void sendReply(ticket.id)} className="self-end rounded bg-teal-700 px-3 py-2 text-sm hover:bg-teal-600">Send</button></div></div>
      </div>
    </article>)}{visibleTickets.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">No tickets in this queue.</p>}</div>
  </main>;
}
