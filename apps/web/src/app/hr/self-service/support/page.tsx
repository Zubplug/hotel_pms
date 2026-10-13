'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Inbox, MessageSquare, Plus, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmployeePortalFeedbackDialog, type EmployeePortalFeedback } from '@/components/hr/EmployeePortalFeedbackDialog';

const openStatuses = ['OPEN', 'IN_PROGRESS', 'AWAITING_EMPLOYEE'];

export default function EmployeeSupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [reply, setReply] = useState('');
  const [form, setForm] = useState({ category: 'GENERAL', subject: '', description: '', priority: 'MEDIUM' });
  const [newOpen, setNewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<EmployeePortalFeedback | null>(null);

  async function loadTickets(preferredId?: string) {
    setLoading(true);
    try {
      const response = await fetch('/api/hr/service-desk');
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load HR requests');
      const nextTickets = json.tickets || [];
      setTickets(nextTickets);
      setSelectedId(preferredId || selectedId || nextTickets[0]?.id || '');
    } catch (error: any) { setFeedback({ type: 'error', title: 'Support center unavailable', message: error.message || 'Please try again.' }); } finally { setLoading(false); }
  }

  useEffect(() => { void loadTickets(); }, []);

  const filteredTickets = useMemo(() => tickets.filter((ticket) => filter === 'ALL' || (filter === 'OPEN' ? openStatuses.includes(ticket.status) : ticket.status === filter)), [tickets, filter]);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) || filteredTickets[0];

  async function createTicket(event: FormEvent) {
    event.preventDefault(); setWorking(true);
    try {
      const response = await fetch('/api/hr/service-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to create request');
      setForm({ category: 'GENERAL', subject: '', description: '', priority: 'MEDIUM' }); setNewOpen(false); await loadTickets(json.ticket?.id); setFeedback({ type: 'success', title: 'Request submitted', message: 'Your HR request has been created and is now visible in your support inbox.' });
    } catch (error: any) { setFeedback({ type: 'error', title: 'Request not submitted', message: error.message || 'Please try again.' }); } finally { setWorking(false); }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault(); if (!selectedTicket || !reply.trim()) return; setWorking(true);
    try {
      const response = await fetch('/api/hr/service-desk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'REPLY', ticketId: selectedTicket.id, body: reply }) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to send reply');
      setReply(''); await loadTickets(selectedTicket.id); setFeedback({ type: 'success', title: 'Reply sent', message: 'Your message has been added to this HR request.' });
    } catch (error: any) { setFeedback({ type: 'error', title: 'Reply not sent', message: error.message || 'Please try again.' }); } finally { setWorking(false); }
  }

  const statusTone = (status: string) => status === 'RESOLVED' || status === 'CLOSED' ? 'text-emerald-300 bg-emerald-400/10' : status === 'AWAITING_EMPLOYEE' ? 'text-amber-300 bg-amber-400/10' : 'text-cyan-300 bg-cyan-400/10';

  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header className="flex flex-col gap-4 rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-[#102538] to-[#0b1624] p-6 shadow-2xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between sm:p-8"><div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300"><MessageSquare className="h-7 w-7" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Employee support</p><h1 className="mt-1 text-2xl font-bold text-white">HR Support Center</h1><p className="mt-1 text-sm text-slate-400">Follow up on requests, share information, and stay connected with HR.</p></div></div><Button onClick={() => setNewOpen(true)} className="h-10 gap-2 bg-teal-600 text-xs text-white hover:bg-teal-500"><Plus className="h-4 w-4" /> New request</Button></header>

    <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Total requests</p><p className="mt-2 text-2xl font-bold text-white">{tickets.length}</p></div><div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">In progress</p><p className="mt-2 text-2xl font-bold text-cyan-300">{tickets.filter((ticket) => openStatuses.includes(ticket.status)).length}</p></div><div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">Resolved</p><p className="mt-2 text-2xl font-bold text-emerald-300">{tickets.filter((ticket) => ['RESOLVED', 'CLOSED'].includes(ticket.status)).length}</p></div></section>

    <section className="grid min-h-[560px] gap-4 lg:grid-cols-[360px_1fr]"><div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1624]"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="text-sm font-bold text-white">My requests</h2><p className="mt-1 text-[10px] text-slate-500">Select a request to view the thread</p></div><Select value={filter} onValueChange={(value) => value && setFilter(value)}><SelectTrigger className="h-8 w-28 !border-slate-700 !bg-slate-950 text-[10px] !text-slate-200"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="ALL">All requests</SelectItem><SelectItem value="OPEN">Open</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent></Select></div><div className="max-h-[480px] overflow-y-auto p-2">{loading ? <p className="p-8 text-center text-xs text-slate-500">Loading requests…</p> : filteredTickets.length ? filteredTickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedTicket?.id === ticket.id ? 'border-teal-400/40 bg-teal-400/10' : 'border-transparent hover:border-slate-700 hover:bg-slate-950'}`}><div className="flex items-start justify-between gap-2"><span className="truncate text-xs font-semibold text-white">{ticket.subject}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${statusTone(ticket.status)}`}>{ticket.status.replaceAll('_', ' ')}</span></div><p className="mt-2 text-[10px] text-slate-500">{ticket.ticketNumber} · {new Date(ticket.createdAt).toLocaleDateString()}</p></button>) : <div className="p-8 text-center"><Inbox className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-3 text-xs text-slate-500">No requests in this view.</p><button type="button" onClick={() => setNewOpen(true)} className="mt-3 text-xs text-teal-300 hover:text-teal-200">Create your first request</button></div>}</div></div>

      <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1624]">{selectedTicket ? <><div className="border-b border-slate-800 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-teal-300">{selectedTicket.ticketNumber}</p><h2 className="mt-1 text-lg font-bold text-white">{selectedTicket.subject}</h2><p className="mt-2 text-xs text-slate-500">{selectedTicket.category} · Priority {selectedTicket.priority} · Opened {new Date(selectedTicket.createdAt).toLocaleDateString()}</p></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${statusTone(selectedTicket.status)}`}>{selectedTicket.status.replaceAll('_', ' ')}</span></div><p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-300">{selectedTicket.description}</p></div><div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">{selectedTicket.messages?.length ? selectedTicket.messages.map((message: any) => <div key={message.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p className="text-sm leading-6 text-slate-300">{message.body}</p><p className="mt-2 text-[10px] text-slate-600">{new Date(message.createdAt).toLocaleString()}</p></div>) : <div className="flex h-full min-h-32 flex-col items-center justify-center text-center"><Clock3 className="h-8 w-8 text-slate-700" /><p className="mt-3 text-xs text-slate-500">No replies yet. HR will respond here.</p></div>}</div>{!['RESOLVED', 'CLOSED'].includes(selectedTicket.status) && <form onSubmit={sendReply} className="border-t border-slate-800 bg-slate-950/40 p-4 sm:p-5"><div className="flex gap-2"><Input required value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply or add information…" className="h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /><Button disabled={working} className="h-10 gap-2 bg-teal-600 text-xs text-white hover:bg-teal-500"><Send className="h-3.5 w-3.5" />Send</Button></div></form>}</> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><MessageSquare className="h-10 w-10 text-slate-700" /><h2 className="mt-4 text-base font-bold text-white">Your support inbox</h2><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">Create a request when you need help from HR.</p><Button onClick={() => setNewOpen(true)} className="mt-5 bg-teal-600 text-xs text-white hover:bg-teal-500">Create request</Button></div>}</div></section>

    {newOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={createTicket} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-[#0b1624] p-6 shadow-2xl shadow-black/50"><div><h2 className="text-lg font-bold text-white">Create HR request</h2><p className="mt-1 text-xs text-slate-500">Give HR enough context to resolve your request quickly.</p></div><Select value={form.category} onValueChange={(value) => value && setForm({ ...form, category: value })}><SelectTrigger className="h-10 w-full !border-slate-700 !bg-slate-950 text-xs !text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="GENERAL">General HR support</SelectItem><SelectItem value="SALARY_INQUIRY">Salary or payslip</SelectItem><SelectItem value="PROFILE_UPDATE">Profile update</SelectItem><SelectItem value="LEAVE_INQUIRY">Leave inquiry</SelectItem><SelectItem value="ATTENDANCE">Attendance issue</SelectItem><SelectItem value="EMPLOYMENT_LETTER">Employment letter</SelectItem><SelectItem value="GRIEVANCE">Confidential concern</SelectItem></SelectContent></Select><div className="grid gap-3 sm:grid-cols-[1fr_150px]"><Input required placeholder="Subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="h-10 border-slate-700 bg-slate-950 text-sm text-slate-100" /><Select value={form.priority} onValueChange={(value) => value && setForm({ ...form, priority: value })}><SelectTrigger className="h-10 !border-slate-700 !bg-slate-950 text-xs !text-slate-100"><SelectValue /></SelectTrigger><SelectContent className="border-slate-700 bg-slate-900 text-slate-100"><SelectItem value="LOW">Low priority</SelectItem><SelectItem value="MEDIUM">Medium priority</SelectItem><SelectItem value="HIGH">High priority</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></div><textarea required placeholder="Describe your request" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-400" /><div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><Button type="button" variant="outline" onClick={() => setNewOpen(false)} className="!border-slate-700 !bg-slate-900 text-xs !text-slate-100">Cancel</Button><Button disabled={working} className="gap-2 bg-teal-600 text-xs text-white hover:bg-teal-500">{working ? 'Submitting…' : 'Submit request'}</Button></div></form></div>}
    <EmployeePortalFeedbackDialog feedback={feedback} onClose={() => setFeedback(null)} />
  </main>;
}
