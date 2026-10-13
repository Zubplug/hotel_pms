'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmployeeChangeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const response = await fetch('/api/hr/profile-change-requests'); const json = await response.json(); if (!response.ok) throw new Error(json.error || 'Unable to load requests'); setRequests(json.requests || []); } catch (cause: any) { setError(cause.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function review(id: string, status: string) {
    const reviewerNotes = window.prompt(status === 'REJECTED' ? 'Reason for rejection' : 'Reviewer note (optional)') || '';
    const response = await fetch('/api/hr/profile-change-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, reviewerNotes }) });
    const json = await response.json();
    if (!response.ok) setError(json.error || 'Unable to review request'); else load();
  }

  return <main className="space-y-6 p-6 text-white"><div><h1 className="text-2xl font-bold">Employee Change Requests</h1><p className="mt-1 text-sm text-slate-400">Review employee-submitted profile and payroll-information changes.</p></div>{error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}{loading ? <p className="text-sm text-slate-400">Loading requests…</p> : <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"><table className="w-full text-left text-sm"><thead className="border-b border-slate-800 bg-slate-900 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Employee</th><th className="p-4">Field</th><th className="p-4">Requested value</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-800">{requests.map((request) => <tr key={request.id}><td className="p-4"><p className="font-medium">{request.staff?.firstName} {request.staff?.lastName}</p><p className="text-xs text-slate-500">{request.staff?.employeeId} · {request.staff?.department}</p></td><td className="p-4 text-slate-300">{request.fieldName}</td><td className="max-w-xs truncate p-4 text-slate-300">{request.proposedValue}</td><td className="p-4"><span className="inline-flex items-center gap-1 text-xs text-amber-300"><Clock3 className="h-3.5 w-3.5" />{request.status}</span></td><td className="p-4 text-right">{['PENDING', 'CLARIFICATION'].includes(request.status) && <span className="inline-flex gap-2"><Button size="sm" onClick={() => review(request.id, 'APPROVED')} className="bg-emerald-700 text-xs hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve</Button><Button size="sm" variant="outline" onClick={() => review(request.id, 'REJECTED')} className="border-rose-800 text-xs text-rose-300"><XCircle className="mr-1 h-3.5 w-3.5" />Reject</Button></span>}</td></tr>)}{requests.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No employee change requests.</td></tr>}</tbody></table></div>}</main>;
}
