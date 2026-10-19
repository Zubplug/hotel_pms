'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const money = (value: unknown) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

export default function SelfServiceCompensationPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/hr/self-service/compensation');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load compensation changes');
    setRequests(data.requests || []);
  }

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  async function acknowledge(id: string) {
    const response = await fetch('/api/hr/self-service/compensation', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action: 'ACKNOWLEDGE' }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Unable to acknowledge change'); else load();
  }

  return <main className="mx-auto max-w-4xl space-y-6 p-4 text-white sm:p-6"><div><Link href="/hr/self-service" className="text-sm text-teal-300">← Employee portal</Link><h1 className="mt-3 text-2xl font-bold">Compensation changes</h1><p className="mt-1 text-sm text-slate-400">Review approved salary changes and their effective dates.</p></div>{error && <p className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</p>}<div className="space-y-3">{requests.map((request) => <article key={request.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded bg-slate-800 px-2 py-1 text-xs text-teal-300">{request.status}</span><h2 className="mt-3 font-semibold">Salary and allowance revision</h2><p className="mt-1 text-sm text-slate-400">Effective {new Date(request.effectiveDate).toLocaleDateString('en-NG')} {request.probationReviewDate ? `· Review ${new Date(request.probationReviewDate).toLocaleDateString('en-NG')}` : ''}</p></div><div className="text-right text-sm"><p>{money(request.currentBasicSalary)} → <span className="font-semibold text-emerald-300">{money(request.proposedBasicSalary)}</span></p><p className="text-xs text-slate-500">Total package change: {Number(request.increasePercentage || 0).toFixed(2)}%</p></div></div><div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-3"><span>Housing: {money(request.proposedHousingAllowance)}</span><span>Transport: {money(request.proposedTransportAllowance)}</span><span>Other: {money(request.proposedOtherAllowances)}</span></div><p className="mt-3 rounded-lg bg-slate-900 p-3 text-sm text-slate-300">Reason: {request.reason}</p>{request.supportingDocumentUrl && <a href={request.supportingDocumentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-teal-300">View supporting document →</a>}{request.rejectionReason && <p className="mt-2 text-sm text-rose-300">Note: {request.rejectionReason}</p>}{['APPROVED', 'SCHEDULED', 'APPLIED'].includes(request.status) && <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{request.employeeAcknowledgedAt ? 'Acknowledged' : 'Please acknowledge that you have received this notice.'}</p>{!request.employeeAcknowledgedAt && <button type="button" onClick={() => void acknowledge(request.id)} className="rounded bg-teal-700 px-3 py-2 text-sm hover:bg-teal-600">Acknowledge</button>}</div>}</article>)}{requests.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">No compensation changes have been published.</p>}</div></main>;
}
