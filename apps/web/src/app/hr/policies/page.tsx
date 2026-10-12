'use client';

import { useEffect, useState } from 'react';

export default function HrPoliciesPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const load = () => fetch('/api/hr/policies').then((r) => r.json()).then((d) => setPolicies(d.policies || []));
  useEffect(() => { void load(); }, []);
  async function acknowledge(policyId: string) {
    const response = await fetch('/api/hr/policies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ACKNOWLEDGE', policyId }) });
    if (!response.ok) alert((await response.json()).error || 'Unable to acknowledge policy'); else load();
  }
  return <main className="p-6 max-w-5xl mx-auto space-y-6 text-white"><div><h1 className="text-2xl font-bold">Company Policies</h1><p className="text-sm text-slate-400">Review effective policies and record employee acknowledgement.</p></div><div className="grid gap-3">{policies.map((policy) => <article key={policy.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex items-center justify-between gap-4"><div><h2 className="font-semibold">{policy.title} <span className="text-xs text-slate-500">v{policy.version}</span></h2><p className="text-xs text-slate-400 mt-1">{policy.category} · Effective {new Date(policy.effectiveDate).toLocaleDateString()}</p><a className="text-xs text-teal-400 underline" href={policy.fileUrl} target="_blank" rel="noreferrer">Open policy document</a></div>{policy.requiresAcknowledgement && <button disabled={Boolean(policy.acknowledgedAt)} onClick={() => acknowledge(policy.id)} className="rounded bg-teal-600 disabled:bg-slate-700 px-3 py-2 text-sm">{policy.acknowledgedAt ? 'Acknowledged' : 'Acknowledge'}</button>}</article>)}</div></main>;
}
