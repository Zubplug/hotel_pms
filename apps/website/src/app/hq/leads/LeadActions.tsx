'use client';

import { useState } from 'react';

export function LeadActions({ leadId, status, defaultOrganizationName }: { leadId: string; status: string; defaultOrganizationName: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  async function update(action: 'QUALIFY' | 'CONVERT') {
    setState('working');
    const organizationName = action === 'CONVERT' ? window.prompt('Organization name', defaultOrganizationName) : undefined;
    if (action === 'CONVERT' && organizationName === null) { setState('idle'); return; }
    const response = await fetch(`/api/hq/leads/${leadId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, organizationName }) });
    setState(response.ok ? 'done' : 'error');
    if (response.ok) window.location.reload();
  }
  if (status === 'CONVERTED') return <span className="text-xs text-emerald-300">Invitation sent</span>;
  return <div className="flex justify-end gap-2">{status === 'NEW' && <button onClick={() => update('QUALIFY')} disabled={state === 'working'} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[.06]">Qualify</button>}<button onClick={() => update('CONVERT')} disabled={state === 'working'} className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400">{state === 'working' ? 'Working…' : 'Convert & invite'}</button>{state === 'error' && <span className="self-center text-xs text-rose-300">Failed</span>}</div>;
}

