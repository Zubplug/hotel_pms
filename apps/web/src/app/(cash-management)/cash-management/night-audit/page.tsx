'use client';

import { useEffect, useState } from 'react';
import { useProperty } from '@/components/PropertyProvider';
import { NightAuditData } from '@/types/night-audit';
import { StatusBanner } from '@/components/night-audit/dashboard/status-banner';
import { MetricCards } from '@/components/night-audit/dashboard/metric-cards';
import { AuditReadiness } from '@/components/night-audit/dashboard/audit-readiness';
import { ActivityFeed } from '@/components/night-audit/dashboard/activity-feed';
import { AuditWizard } from '@/components/night-audit/audit-wizard';
import { AlertTriangle, CheckCircle2, Loader2, LockKeyhole, Play, RefreshCcw, ShieldCheck } from 'lucide-react';

export default function CashierNightAuditPage() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<NightAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${encodeURIComponent(propertyId)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load Night Audit status');
      setData(body.data);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load Night Audit status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, [propertyId]);

  const execute = async () => {
    if (!propertyId) return;
    setExecuting(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/v1/night-audit/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || body.error || 'Night Audit execution failed');
      setWizardOpen(false); setMessage('Night Audit completed successfully.'); await load(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Night Audit execution failed');
    } finally { setExecuting(false); }
  };

  if (propertyLoading || loading) return <div className="flex min-h-full items-center justify-center bg-[#060c18]"><div className="flex flex-col items-center gap-3 text-slate-400"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /><span className="text-sm">Loading cashier audit view…</span></div></div>;
  if (!data) return <div className="flex min-h-full items-center justify-center bg-[#060c18] p-6"><div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-6 text-center text-rose-200">{error || 'Select a property to view the audit.'}</div></div>;

  const inProgress = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';
  const completed = data.auditState === 'COMPLETED';
  const canStart = !inProgress && !completed;

  return <div className="min-h-full bg-[linear-gradient(160deg,#060c18_0%,#080e1f_60%,#0a0c22_100%)] px-4 pb-16 pt-6 sm:px-6 md:px-8"><div className="mx-auto max-w-[1500px] space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-300">Cash Management / Read-only controls</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Night Audit oversight</h1><p className="mt-1 text-sm text-slate-400">Monitor readiness and daily close controls without entering the full management audit workspace.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:opacity-50"><RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh status</button>{canStart && <button onClick={() => setWizardOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-500"><Play className="h-4 w-4 fill-current" />Open audit wizard</button>}</div></div>{error && <div className="flex items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-5 py-4 text-sm font-semibold text-rose-300"><AlertTriangle className="h-5 w-5" />{error}</div>}{message && <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-4 text-sm font-semibold text-emerald-300"><CheckCircle2 className="h-5 w-5" />{message}</div>}<StatusBanner data={data} isAuditInProgress={inProgress} onOpenWizard={() => setWizardOpen(true)} refreshing={refreshing} managerMode /><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500"><LockKeyhole className="h-4 w-4 text-indigo-400" />Access mode</div><p className="mt-3 text-lg font-bold text-white">Read-only oversight</p><p className="mt-1 text-xs leading-5 text-slate-500">Operational records are visible here; detailed corrections remain in the controlled audit workflow.</p></div><div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400" />Run availability</div><p className={`mt-3 text-lg font-bold ${inProgress ? 'text-sky-300' : completed ? 'text-emerald-300' : 'text-indigo-300'}`}>{inProgress ? 'Audit in progress' : completed ? 'Cycle completed' : 'Wizard available'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{inProgress ? 'Execution is locked while posting is active.' : completed ? 'The business date has already been closed.' : 'Run the wizard when the Night Auditor is unavailable and you are authorised.'}</p></div><div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-500"><AlertTriangle className="h-4 w-4 text-amber-400" />Attention</div><p className="mt-3 text-lg font-bold text-white">{data.summary.blockers} blockers · {data.summary.warnings} warnings</p><p className="mt-1 text-xs leading-5 text-slate-500">Review the readiness controls before opening the execution wizard.</p></div></div><MetricCards data={data} /><div className="grid gap-5 lg:grid-cols-2"><AuditReadiness data={data} /><ActivityFeed data={data} /></div></div><AuditWizard open={wizardOpen} onOpenChange={setWizardOpen} data={data} onExecute={execute} executing={executing} onRefresh={() => load(true)} /></div>;
}
