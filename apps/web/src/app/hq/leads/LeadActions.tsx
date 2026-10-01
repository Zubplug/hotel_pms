'use client';

import { useState } from 'react';

export function LeadActions({ leadId, status, defaultOrganizationName }: { leadId: string; status: string; defaultOrganizationName: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [orgName, setOrgName] = useState(defaultOrganizationName);

  async function update(action: 'QUALIFY' | 'CONVERT', organizationName?: string) {
    setState('working');
    const response = await fetch(`/api/hq/leads/${leadId}`, { 
      method: 'PATCH', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify({ action, organizationName }) 
    });
    setState(response.ok ? 'done' : 'error');
    if (response.ok) window.location.reload();
  }

  function handleConvertSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    update('CONVERT', orgName.trim());
  }

  if (status === 'CONVERTED') return <span className="text-xs text-emerald-400 font-medium px-2 py-1 bg-emerald-500/10 rounded-full ring-1 ring-emerald-500/20">Invitation sent</span>;

  return (
    <>
      <div className="flex justify-end gap-2">
        {status === 'NEW' && (
          <button 
            onClick={() => update('QUALIFY')} 
            disabled={state === 'working'} 
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[.06] transition-colors"
          >
            Qualify
          </button>
        )}
        <button 
          onClick={() => setShowConvertModal(true)} 
          disabled={state === 'working'} 
          className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400 transition-colors shadow-sm"
        >
          {state === 'working' ? 'Working…' : 'Convert & invite'}
        </button>
        {state === 'error' && <span className="self-center text-xs text-rose-400">Failed</span>}
      </div>

      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#0b1628] shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white tracking-tight">Convert to Customer</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                This will create a new dedicated workspace for this customer and instantly send an invitation email to their address with a link to set their password.
              </p>
              
              <form onSubmit={handleConvertSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
                    Organization name
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow"
                  />
                </div>
                
                <div className="mt-8 flex justify-end gap-3 border-t border-white/5 pt-5">
                  <button 
                    type="button" 
                    onClick={() => setShowConvertModal(false)}
                    disabled={state === 'working'}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[.06] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={state === 'working' || !orgName.trim()}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-400 transition-colors disabled:opacity-50"
                  >
                    {state === 'working' ? 'Converting…' : 'Convert & send invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
