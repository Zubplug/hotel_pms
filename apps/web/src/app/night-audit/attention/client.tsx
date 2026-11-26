'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, MoonStar, RefreshCcw, AlertTriangle } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import { AttentionQueue } from '@/components/night-audit/dashboard/attention-queue';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';

export function AttentionQueueClient() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutionAction, setResolutionAction] = useState<ResolutionAction>(null);

  const load = useCallback(async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || 'Unable to load the attention queue');
      setData(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the attention queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!propertyId) return;
    const timer = window.setInterval(() => { void load(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [propertyId, load]);

  const handleResolutionSuccess = () => {
    setResolutionAction(null);
    void load(true);
  };

  if (propertyLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-indigo-400" />Loading attention queue…</div>;
  }

  if (!data) {
    return <div className="mx-auto max-w-3xl p-6 text-center text-sm text-rose-300">{error || 'No attention data is available.'}</div>;
  }

  return (
    <div className="min-h-full bg-[linear-gradient(160deg,#030712_0%,#05090f_55%,#070a18_100%)] px-4 pb-16 pt-5 sm:px-6 md:px-8">
      <div className="mx-auto max-w-[1200px] space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <Link href="/night-audit" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-200"><ArrowLeft className="h-3.5 w-3.5" />Back to Audit Overview</Link>
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-400/10"><MoonStar className="h-5 w-5 text-rose-300" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300/70">Night Audit / Controls</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Attention Queue</h1></div></div>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">Resolve blockers and review warnings before closing the business date for {data.property.name}.</p>
          </div>
          <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCcw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh</button>
        </div>

        {error && <div className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-300"><AlertTriangle className="h-4 w-4" />{error}</div>}
        <AttentionQueue data={data} onResolveItem={(action, item) => setResolutionAction({ type: action as any, item })} />
      </div>
      <ResolutionManager action={resolutionAction} onClose={() => setResolutionAction(null)} onSuccess={handleResolutionSuccess} />
    </div>
  );
}
