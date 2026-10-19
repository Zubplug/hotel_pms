'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const money = (value: unknown) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

export default function CompensationIncreaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [request, setRequest] = useState<any | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { params.then(({ id }) => fetch(`/api/hr/compensation/increases?id=${id}`).then(async (response) => { const data = await response.json(); if (!response.ok || !data.requests?.[0]) throw new Error(data.error || 'Request not found'); setRequest(data.requests[0]); }).catch((cause) => setError(cause.message))); }, [params]);
  if (error) return <main className="p-6 text-rose-300">{error}</main>;
  if (!request) return <main className="p-6 text-slate-400">Loading compensation request…</main>;
  return <main className="mx-auto max-w-3xl space-y-6 p-6 text-white"><div className="flex items-center justify-between"><div><Link href="/hr/compensation/increases" className="text-sm text-teal-300">← Compensation queue</Link><h1 className="mt-3 text-2xl font-bold">Compensation change detail</h1></div><button type="button" onClick={() => window.print()} className="rounded border border-slate-700 px-3 py-2 text-sm">Print / save PDF</button></div><article className="space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-5"><p className="text-xs text-teal-300">{request.status}</p><h2 className="text-xl font-semibold">{request.staff?.firstName} {request.staff?.lastName}</h2><p className="text-sm text-slate-400">{request.staff?.department} · {request.staff?.position}</p><div className="grid gap-3 text-sm sm:grid-cols-2"><p>Current package: {money(request.currentBasicSalary)}</p><p>Proposed package: {money(request.proposedBasicSalary)}</p><p>Increase: {Number(request.increasePercentage || 0).toFixed(2)}%</p><p>Effective: {new Date(request.effectiveDate).toLocaleDateString('en-NG')}</p></div><p className="rounded-lg bg-slate-900 p-3 text-sm">{request.reason}</p><div><h3 className="font-semibold">Payroll impact preview</h3><pre className="mt-2 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-300">{JSON.stringify(request.payrollImpact, null, 2)}</pre></div>{request.supportingDocumentUrl && <a href={request.supportingDocumentUrl} target="_blank" rel="noreferrer" className="text-sm text-teal-300">Open supporting document →</a>}</article></main>;
}
