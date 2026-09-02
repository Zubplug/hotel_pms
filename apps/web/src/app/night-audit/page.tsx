'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useProperty } from '@/components/PropertyProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertTriangle, ArrowRight, Banknote, Building2, Check, CheckCircle2, ClipboardCheck,
  Clock3, FileBarChart, FileCheck2, Loader2, MoonStar, Play, RefreshCw, ShieldCheck,
  SlidersHorizontal, TrendingUp, Users, XCircle
} from 'lucide-react';
import { ResolutionManager, ResolutionAction } from '@/components/night-audit/resolution-manager';

type AuditData = any;

const currency = (value: number, code = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

const steps = [
  { title: 'Operations', description: 'Arrivals, departures and room status', icon: Building2 },
  { title: 'System control', description: 'POS sessions and financial sync', icon: SlidersHorizontal },
  { title: 'Financial review', description: 'Folios, balances and rate checks', icon: FileCheck2 },
  { title: 'Cash control', description: 'Handovers and bank deposits', icon: Banknote },
  { title: 'Final sign-off', description: 'Confirm readiness and roll the date', icon: ShieldCheck },
];

function Metric({ label, value, tone = 'slate', icon: Icon }: { label: string; value: string | number; tone?: string; icon: React.ElementType }) {
  const iconTone = tone === 'rose' ? 'text-rose-500' : tone === 'amber' ? 'text-amber-500' : tone === 'indigo' ? 'text-indigo-500' : tone === 'emerald' ? 'text-emerald-500' : 'text-slate-500';
  return <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900">
    <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon className={`h-5 w-5 ${iconTone}`} /></div>
    <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>

    </div>;
}

export default function NightAuditDashboard() {
  const { propertyId, isLoading: propertyLoading } = useProperty();
  const [data, setData] = useState<AuditData>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [executing, setExecuting] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [rechecked, setRechecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [resolutionAction, setResolutionAction] = useState<ResolutionAction>(null);

  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [ackInputs, setAckInputs] = useState<Record<string, {reason: string, comment: string}>>({});
  const [acking, setAcking] = useState<Record<string, boolean>>({});


  const load = async (quiet = false) => {
    if (!propertyId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const response = await fetch(`/api/v1/night-audit/status?propertyId=${propertyId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Unable to load audit status');
      setData(result.data);
      if (result.data.auditState === 'OVERDUE') setWizardOpen(true);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, [propertyId]);

  useEffect(() => {
    if (data?.currentAudit?.acknowledgements) {
      const existingAcks = data.currentAudit.acknowledgements.reduce((acc: any, ack: any) => {
        acc[ack.warningType] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setAcks(existingAcks);
    }
  }, [data?.currentAudit?.acknowledgements]);

  const requiredAcks = useMemo(() => {
    const arr = [];
    if (data?.operational?.arrivals?.some((a: any) => a.status === 'CONFIRMED')) arr.push({ type: 'PENDING_ARRIVALS', title: 'Pending Arrivals', desc: 'There are still confirmed arrivals for today.' });
    if (data?.operational?.departures?.some((d: any) => d.status === 'CHECKED_IN')) arr.push({ type: 'PENDING_DEPARTURES', title: 'Pending Departures', desc: 'There are still checked-in departures for today.' });
    if (data?.financial?.highBalances?.length > 0) arr.push({ type: 'HIGH_BALANCE', title: 'High Balance Folios', desc: 'Some folios have exceeded the high balance limit.' });
    if (data?.financial?.rateVariances?.length > 0) arr.push({ type: 'RATE_VARIANCE', title: 'Rate Variances', desc: 'Some active room charges deviate from their booked rate.' });
    return arr;
  }, [data]);

  const handleAck = async (type: string) => {
    const input = ackInputs[type] || { reason: '', comment: '' };
    if (!input.reason) return alert('Reason is required');
    setAcking(prev => ({...prev, [type]: true}));
    try {
      const res = await fetch('/api/v1/night-audit/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, nightAuditId: data?.pendingRun?.id, warningType: type, reason: input.reason, comment: input.comment })
      });
      if (!res.ok) throw new Error('Failed to acknowledge');
      setAcks(prev => ({...prev, [type]: true}));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAcking(prev => ({...prev, [type]: false}));
    }
  };


  const blockers = data?.summary?.blockers || 0;
  const warnings = data?.summary?.warnings || 0;
  const checks = useMemo(() => [
    ...(data?.operational?.arrivals || []).map((item: any) => ({ label: `Arrival · ${item.primaryGuest?.firstName || 'Guest'} ${item.primaryGuest?.lastName || ''}`, tone: 'warning' })),
    ...(data?.operational?.departures || []).map((item: any) => ({ label: `Departure · ${item.primaryGuest?.firstName || 'Guest'} ${item.primaryGuest?.lastName || ''}`, tone: 'warning' })),
    ...(data?.system?.openPosSessions || []).map((item: any) => ({ label: `Open POS · ${item.outlet?.name || 'Register'}`, tone: 'blocker' })),
    ...(data?.system?.openFrontdeskSessions || []).map((item: any) => ({ label: `Open cashier shift · ${item.shiftReference || 'Front desk'}`, tone: 'blocker' })),
    ...(data?.system?.financialSyncConflicts || []).map(() => ({ label: 'Financial sync conflict', tone: 'blocker' })),
    ...(data?.cash?.unverifiedTransactions || []).map((item: any) => ({ label: `Unverified ${item.method === 'BANK_TRANSFER' ? 'Transfer' : 'POS'} · ${item.amount}`, tone: 'blocker' })),
  ], [data]);

  const execute = async () => {
    setExecuting(true); setError(null);
    try {
      const response = await fetch('/api/v1/night-audit/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Audit execution failed');
      setWizardOpen(false); setStep(0); setMessage(`Audit completed. ${result.data?.roomChargesPosted || 0} room charges posted.`); await load(true);
    } catch (err: any) { setError(err.message); }
    finally { setExecuting(false); }
  };

  const recheck = async () => {
    setRechecking(true);
    await load(true);
    setRechecked(true);
    setRechecking(false);
  };

  if (propertyLoading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (!propertyId) return <div className="flex min-h-[60vh] items-center justify-center text-center"><div><MoonStar className="mx-auto h-10 w-10 text-indigo-500" /><h2 className="mt-4 text-xl font-semibold">Select a property</h2><p className="mt-1 text-muted-foreground">Choose a property to open the audit workspace.</p></div>
  
    </div>;
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
  
    </div>;

  const businessDate = data?.currentBusinessDate ? new Date(data.businessDate) : new Date();
  const isAuditInProgress = (data?.auditState === 'IN_PROGRESS' || data?.auditState === 'POSTING');
  const auditState = data?.auditState || 'PENDING';
  const isReady = blockers === 0 && !isAuditInProgress;

  return <div className="space-y-8">
    
    <div className="space-y-4">
      {data?.auditState === 'FAILED' && <div className="flex items-center justify-between rounded-xl bg-rose-50 p-4 border border-rose-200"><div className="flex items-center gap-3 text-rose-700"><AlertTriangle className="h-5 w-5" /><span>Last audit failed — review audit logs and retry</span></div><Button variant="outline" size="sm" onClick={() => load(true)}>Retry</Button></div>}
      {data?.auditState === 'OVERDUE' && <div className="flex items-center gap-3 rounded-xl bg-orange-50 p-4 border border-orange-200 text-orange-700"><AlertTriangle className="h-5 w-5" /><span>Night audit is overdue — current business date needs to be closed</span></div>}
      {data?.auditState === 'IN_PROGRESS' && <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 border border-blue-200 text-blue-700"><Loader2 className="h-5 w-5 animate-spin" /><span>Night audit is currently running...</span></div>}
      {data?.auditState === 'POSTING' && <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 border border-blue-200 text-blue-700"><Loader2 className="h-5 w-5 animate-spin" /><span>Posting room charges...</span></div>}
      {data?.auditState === 'COMPLETED' && <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-emerald-700"><CheckCircle2 className="h-5 w-5" /><span>Business day closed successfully</span></div>}
    </div>

    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><div className="flex items-center gap-2 text-sm font-medium text-indigo-600"><MoonStar className="h-4 w-4" /> Auditor workspace</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">Night audit control centre</h1><p className="mt-2 text-muted-foreground">A clear view of readiness, controls and the next business date.</p></div>
      <div className="flex items-center gap-3"><Button variant="outline" onClick={() => load(true)} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button><Button disabled={isAuditInProgress} onClick={() => { setStep(0); setWizardOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700"><Play className="mr-2 h-4 w-4" />{isAuditInProgress ? 'Audit processing' : 'Open audit flow'}</Button></div>
    </div>

    <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-center"><div><p className="text-sm font-medium text-indigo-300">Current business date</p><p className="mt-2 text-3xl font-semibold">{format(businessDate, 'EEEE, dd MMMM yyyy')}</p><p className="mt-2 text-sm text-slate-400">{data?.property?.name || 'Property'} · {isAuditInProgress ? `Audit ${data?.auditPhase?.toLowerCase() || 'in progress'}` : data?.auditState === 'COMPLETED' ? 'Audit completed' : 'Audit pending'}</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><div className={`rounded-full p-3 ${data?.auditState === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : isAuditInProgress ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'}`}>{data?.auditState === 'COMPLETED' ? <CheckCircle2 /> : isAuditInProgress ? <Loader2 className="animate-spin" /> : <Clock3 />}</div><div><p className="font-medium">{isAuditInProgress ? 'Audit processing' : data?.auditState === 'COMPLETED' ? 'Signed off' : 'Action required'}</p><p className="text-sm text-slate-400">{data?.activeAudit?.startedAt ? format(new Date(data.activeAudit.startedAt), 'dd MMM · HH:mm') : data?.currentAudit?.completedAt ? format(new Date(data.currentAudit.completedAt), 'dd MMM · HH:mm') : 'No completed run for this date'}</p></div></div></div></div>

    {error && <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><XCircle className="h-5 w-5" />{error}</div>}
    {message && <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="h-5 w-5" />{message}</div>}

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Readiness blockers" value={blockers} tone="rose" icon={XCircle} /><Metric label="Warnings to review" value={warnings} tone="amber" icon={AlertTriangle} /><Metric label="Open POS sessions" value={data?.system?.openPosSessions?.length || 0} tone="indigo" icon={ClipboardCheck} /><Metric label="Open cashier shifts" value={data?.system?.openFrontdeskSessions?.length || 0} tone="rose" icon={ClipboardCheck} /><Metric label="In-house guests" value={data?.financial?.openFolios?.length || 0} tone="emerald" icon={Users} /></div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Business-day revenue" value={currency(data?.analytics?.revenue || 0, data?.property?.baseCurrency)} tone="emerald" icon={TrendingUp} /><Metric label="Payments collected" value={currency(data?.analytics?.payments || 0, data?.property?.baseCurrency)} tone="indigo" icon={Banknote} /><Metric label="Cash variance" value={currency(data?.analytics?.cashVariance || 0, data?.property?.baseCurrency)} tone={Math.abs(data?.analytics?.cashVariance || 0) > 0 ? 'amber' : 'emerald'} icon={Banknote} /><Metric label="Late postings" value={data?.analytics?.latePostings || 0} tone="amber" icon={Clock3} /></div>

    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader><CardTitle>Occupancy analysis</CardTitle><p className="mt-1 text-sm text-muted-foreground">Live room distribution for the current business date.</p></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3"><div className="text-4xl font-semibold">{data?.analytics?.rooms?.total ? Math.round((data.analytics.rooms.occupied / data.analytics.rooms.total) * 100) : 0}%</div><p className="pb-1 text-sm text-muted-foreground">occupancy · {data?.analytics?.rooms?.occupied || 0} of {data?.analytics?.rooms?.total || 0} rooms</p></div>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="bg-indigo-600" style={{ width: `${data?.analytics?.rooms?.total ? (data.analytics.rooms.occupied / data.analytics.rooms.total) * 100 : 0}%` }} /><div className="bg-emerald-400" style={{ width: `${data?.analytics?.rooms?.total ? (data.analytics.rooms.available / data.analytics.rooms.total) * 100 : 0}%` }} /><div className="bg-rose-400" style={{ width: `${data?.analytics?.rooms?.total ? (data.analytics.rooms.outOfOrder / data.analytics.rooms.total) * 100 : 0}%` }} /></div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-600" />Occupied <b>{data?.analytics?.rooms?.occupied || 0}</b></div><div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />Available <b>{data?.analytics?.rooms?.available || 0}</b></div><div><span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-400" />Out of order <b>{data?.analytics?.rooms?.outOfOrder || 0}</b></div></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Seven-day performance</CardTitle><p className="mt-1 text-sm text-muted-foreground">Completed audit revenue trend.</p></CardHeader>
        <CardContent>{data?.analytics?.trend?.length ? <div className="flex h-36 items-end gap-2">{data.analytics.trend.map((day: any) => { const max = Math.max(...data.analytics.trend.map((item: any) => Number(item.totalRevenue) || 0), 1); const height = Math.max(8, ((Number(day.totalRevenue) || 0) / max) * 100); return <div key={String(day.businessDate)} className="group flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-indigo-500 transition-colors group-hover:bg-indigo-600" style={{ height: `${height}%` }} title={`${format(new Date(day.businessDate), 'dd MMM')}: ${currency(Number(day.totalRevenue) || 0, data?.property?.baseCurrency)}`} /><span className="text-[10px] text-muted-foreground">{format(new Date(day.businessDate), 'dd MMM')}</span>      <ResolutionManager action={resolutionAction} onClose={() => setResolutionAction(null)} onSuccess={() => { setResolutionAction(null); load(true); }} />
    </div>; })}</div> : <div className="flex h-36 items-center justify-center rounded-xl border border-dashed bg-slate-50"><p className="text-sm text-muted-foreground">No historical data available</p></div>}</CardContent>
      </Card>
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Readiness overview</CardTitle><p className="mt-1 text-sm text-muted-foreground">The controls that determine whether the date can be closed.</p></div><Badge variant={isReady ? 'default' : 'destructive'}>{isReady ? 'Ready to close' : 'Blocked'}</Badge></CardHeader><CardContent><div className="space-y-3">{steps.slice(0, 4).map((item, index) => { const Icon = item.icon; const count = index === 0 ? (data?.operational?.arrivals?.length || 0) + (data?.operational?.departures?.length || 0) : index === 1 ? (data?.system?.openPosSessions?.length || 0) + (data?.system?.openFrontdeskSessions?.length || 0) + (data?.system?.financialSyncConflicts?.length || 0) : index === 2 ? (data?.financial?.highBalances?.length || 0) : ((data?.cash?.cashHandovers?.length || 0) + (data?.cash?.unverifiedTransactions?.length || 0)); return <div key={item.title} className="flex items-center gap-4 rounded-xl border p-4"><div className="rounded-lg bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.description}</p></div>{count ? <Badge variant="outline" className="text-amber-600">{count} review</Badge> : <Check className="h-5 w-5 text-emerald-500" />}      <ResolutionManager action={resolutionAction} onClose={() => setResolutionAction(null)} onSuccess={() => { setResolutionAction(null); load(true); }} />
    </div>; })}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Attention queue</CardTitle><p className="mt-1 text-sm text-muted-foreground">Items surfaced by the latest control check.</p></CardHeader><CardContent><div className="space-y-3">{checks.slice(0, 5).map((item: any, index: number) => <div key={index} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"><AlertTriangle className={`mt-0.5 h-4 w-4 ${item.tone === 'blocker' ? 'text-rose-500' : 'text-amber-500'}`} /><p className="text-sm">{item.label}</p></div>)}{checks.length === 0 && <div className="py-6 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" /><p className="mt-2 text-sm font-medium">No exceptions surfaced</p><p className="text-xs text-muted-foreground">All monitored controls are clear.</p></div>}</div></CardContent></Card>
    </div>

    <div className="grid gap-4 md:grid-cols-3"><Button variant="outline" className="h-auto justify-start p-4" onClick={() => window.location.href = '/night-audit/history'}><Clock3 className="mr-3 h-5 w-5 text-indigo-500" /><span className="text-left"><b className="block">Audit history</b><small className="text-muted-foreground">Review signed-off dates</small></span><ArrowRight className="ml-auto h-4 w-4" /></Button><Button variant="outline" className="h-auto justify-start p-4" onClick={() => window.location.href = '/night-audit/exceptions'}><AlertTriangle className="mr-3 h-5 w-5 text-amber-500" /><span className="text-left"><b className="block">Exceptions</b><small className="text-muted-foreground">Investigate variances</small></span><ArrowRight className="ml-auto h-4 w-4" /></Button><Button variant="outline" className="h-auto justify-start p-4" onClick={() => window.location.href = '/night-audit/reports'}><FileBarChart className="mr-3 h-5 w-5 text-emerald-500" /><span className="text-left"><b className="block">Audit reports</b><small className="text-muted-foreground">Open the reporting pack</small></span><ArrowRight className="ml-auto h-4 w-4" /></Button></div>

    <Dialog open={wizardOpen} onOpenChange={setWizardOpen}><DialogContent className="!flex !h-[calc(100vh-2rem)] !max-h-[calc(100vh-2rem)] !w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl p-0"><div className="bg-slate-950 px-7 py-6 text-white"><DialogHeader><div className="flex items-start justify-between gap-5"><div className="flex items-center gap-4"><div className="rounded-2xl bg-indigo-500/20 p-3 text-indigo-300"><MoonStar className="h-6 w-6" /></div><div><div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><span>Night audit</span><span className="text-slate-600">/</span><span>Control flow</span></div><DialogTitle className="text-2xl font-semibold text-white">Close business day</DialogTitle><DialogDescription className="mt-1 text-sm text-slate-400">Complete each control before posting charges and rolling the date.</DialogDescription></div></div><div className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right sm:block"><p className="text-xs text-slate-400">Business date</p><p className="mt-1 font-semibold">{format(businessDate, 'dd MMM yyyy')}</p></div></div></DialogHeader><div className="mt-6 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div><span className="text-xs font-medium text-slate-400">{step + 1} of {steps.length}</span></div></div><div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[320px_1fr]"><div className="overflow-y-auto border-r bg-slate-50 p-6 dark:bg-slate-900/50">{steps.map((item, index) => { const Icon = item.icon; return <button key={item.title} onClick={() => setStep(index)} className={`mb-3 flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm transition-colors ${step === index ? 'bg-indigo-100 font-medium text-indigo-800 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-200' : 'text-muted-foreground hover:bg-white dark:hover:bg-slate-800'}`}><span className={`rounded-xl p-2.5 shadow-sm ${step === index ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{step > index ? <Check className="h-4 w-4 text-emerald-500" /> : <Icon className="h-4 w-4" />}</span><span><b className="block">{index + 1}. {item.title}</b><small className="mt-0.5 block leading-4 opacity-80">{item.description}</small></span></button>; })}<div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Audit protocol</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Every close is recorded against the active auditor and business date.</p></div></div><div className="flex min-w-0 flex-col overflow-y-auto p-7 md:p-10"><div><div className="flex items-center gap-3"><span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">STEP {String(step + 1).padStart(2, '0')}</span><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Control review</span></div><h3 className="mt-4 text-2xl font-semibold tracking-tight">{steps[step].title}</h3><p className="mt-2 text-muted-foreground">{steps[step].description}</p></div><div className="mt-8 flex-1 rounded-2xl border bg-slate-50 p-7 dark:bg-slate-900/50">{step < 4 ? <div className="space-y-6"><div className="flex items-start gap-4">{(step === 1 ? blockers : step === 2 ? (data?.financial?.highBalances?.length || 0) : step === 3 ? ((data?.cash?.cashHandovers?.length || 0) + (data?.cash?.unverifiedTransactions?.length || 0)) : ((data?.operational?.arrivals?.length || 0) + (data?.operational?.departures?.length || 0))) > 0 ? <div className="rounded-xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-500/10"><AlertTriangle className="h-6 w-6" /></div> : <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-500/10"><CheckCircle2 className="h-6 w-6" /></div>}<div><p className="text-lg font-semibold">{step === 1 && blockers > 0 ? `${blockers} blocking control${blockers === 1 ? '' : 's'} found` : (step === 0 && ((data?.operational?.arrivals?.length || 0) + (data?.operational?.departures?.length || 0)) > 0) ? 'Pending Operations' : 'Control check complete'}</p><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{step === 0 ? 'Review arrivals and departures before continuing. Any outstanding movement should be resolved or documented.' : 'Review the surfaced items in the workspace if needed, then continue to the next control.'}</p></div></div>

{/* Detail Lists */}
{step === 0 && data?.operational && (
  <div className="space-y-6 border-t pt-4">
    {data.operational.arrivals?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-slate-900">Pending Arrivals</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Guests scheduled to arrive today must be checked in, cancelled, or marked as no-show.</p>
      </div>
      <div className="space-y-2">
        {data.operational.arrivals.map((arr: any) => (
          <div key={arr.id} className="text-sm p-3 bg-white rounded-lg border flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium">{arr.primaryGuest?.firstName} {arr.primaryGuest?.lastName}</p>
              <p className="text-xs text-muted-foreground">Confirmation: {arr.confirmationNumber}</p>
            </div>
            <button onClick={() => setResolutionAction({ type: 'ARRIVALS', item: arr })} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md transition-colors">Resolve</button>
          </div>
        ))}
      </div>
    </div>}
    {data.operational.departures?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-slate-900">Pending Departures</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Guests scheduled to depart today must be checked out or have their stay extended.</p>
      </div>
      <div className="space-y-2">
        {data.operational.departures.map((dep: any) => (
          <div key={dep.id} className="text-sm p-3 bg-white rounded-lg border flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium">{dep.primaryGuest?.firstName} {dep.primaryGuest?.lastName}</p>
              <p className="text-xs text-muted-foreground">Confirmation: {dep.confirmationNumber}</p>
            </div>
            <button onClick={() => setResolutionAction({ type: 'DEPARTURES', item: dep })} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md transition-colors">Resolve</button>
          </div>
        ))}
      </div>
    </div>}
    {data.operational.roomReconciliation?.filter((r: any) => r.issue).length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-amber-700">Room Discrepancies</h4>
        <p className="text-xs text-amber-600/80 mt-0.5">Rooms where the Housekeeping status doesn't match the expected Front Desk status.</p>
      </div>
      <div className="space-y-2">
        {data.operational.roomReconciliation.filter((r: any) => r.issue).map((rm: any) => (
          <div key={rm.roomId} className="text-sm p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-amber-900">Room {rm.roomNumber}</p>
              <p className="text-xs text-amber-700">PMS: {rm.pmsStatus} (Expected: {rm.expected}) | HK: {rm.hkStatus}</p>
            </div>
            <button onClick={() => setResolutionAction({ type: 'ROOM_DISCREPANCY', item: rm })} className="text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-50 px-3 py-1.5 rounded-md transition-colors">Fix</button>
          </div>
        ))}
      </div>
    </div>}
    {!data.operational.arrivals?.length && !data.operational.departures?.length && !data.operational.roomReconciliation?.filter((r: any) => r.issue).length && (
      <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-2 shadow-sm"><CheckCircle2 className="h-4 w-4" /> All arrivals, departures, and rooms are processed.</div>
    )}
  </div>
)}

{step === 1 && data?.system && (
  <div className="space-y-6 border-t pt-4">
    {data.system.openPosSessions?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-rose-700">Open POS Sessions (Blocker)</h4>
        <p className="text-xs text-rose-600/80 mt-0.5">All Point of Sale sessions must be closed and reconciled before the business day can end.</p>
      </div>
      <div className="space-y-2">
        {data.system.openPosSessions.map((pos: any) => (
          <div key={pos.id} className="text-sm p-3 bg-white rounded-lg border border-rose-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-rose-900">{pos.outlet?.name || 'Register'}</p>
              <p className="text-xs text-rose-600">Opened by {pos.openedBy}</p>
            </div>
            <button onClick={() => setResolutionAction({ type: 'POS_SESSION', item: pos })} className="text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-md transition-colors">Resolve</button>
          </div>
        ))}
      </div>
    </div>}
    {data.system.openFrontdeskSessions?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-rose-700">Open Front Desk Shifts (Blocker)</h4>
        <p className="text-xs text-rose-600/80 mt-0.5">All Front Desk cashier shifts must be closed to prevent cross-day posting conflicts.</p>
      </div>
      <div className="space-y-2">
        {data.system.openFrontdeskSessions.map((fd: any) => (
          <div key={fd.id} className="text-sm p-3 bg-white rounded-lg border border-rose-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-rose-900">Shift Reference: {fd.shiftReference}</p>
              <p className="text-xs text-rose-600">Status: {fd.status}</p>
            </div>
            <button onClick={() => setResolutionAction({ type: 'FRONTDESK_SHIFT', item: fd })} className="text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-md transition-colors">Resolve</button>
          </div>
        ))}
      </div>
    </div>}
    {data.system.financialSyncConflicts?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-rose-700">Financial Sync Conflicts (Blocker)</h4>
        <p className="text-xs text-rose-600/80 mt-0.5">Payments or charges failed to sync with the accounting system.</p>
      </div>
      <div className="space-y-2">
        {data.system.financialSyncConflicts.map((sc: any) => (
          <div key={sc.id} className="text-sm p-3 bg-white rounded-lg border border-rose-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-rose-900">Type: {sc.aggregateType}</p>
              <p className="text-xs text-rose-600">Event: {sc.hotelEvent?.eventType || 'Unknown'}</p>
            </div>
            <button onClick={() => setResolutionAction({ type: 'SYNC_CONFLICT', item: sc })} className="text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-md transition-colors">Resolve</button>
          </div>
        ))}
      </div>
    </div>}
    {!data.system.openPosSessions?.length && !data.system.openFrontdeskSessions?.length && !data.system.financialSyncConflicts?.length && (
      <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-2 shadow-sm"><CheckCircle2 className="h-4 w-4" /> All systems and integrations are healthy.</div>
    )}
  </div>
)}

{step === 2 && data?.financial && (
  <div className="space-y-6 border-t pt-4">
    {data.financial.highBalances?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-amber-700">High Balances</h4>
        <p className="text-xs text-amber-600/80 mt-0.5">Review folios exceeding their approved credit limit to secure additional payment or authorization.</p>
      </div>
      <div className="space-y-2">
        {data.financial.highBalances.map((hb: any) => {
          const roomNumber = hb.reservation?.reservationRooms?.[0]?.room?.number || 'Unassigned';
          const guestName = hb.reservation?.primaryGuest ? `${hb.reservation.primaryGuest.firstName} ${hb.reservation.primaryGuest.lastName}` : 'Walk-in';
          const folioStr = hb.folioNumber || hb.reservation?.confirmationNumber || hb.id.split('-')[0].toUpperCase();
          const balance = Number(hb.balance);
          const limit = Number(hb.creditLimit);
          const over = balance - limit;

          return (
            <div key={hb.id} className="text-sm p-4 bg-white rounded-lg border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-amber-950">
                  {guestName} &middot; Room {roomNumber} &middot; Folio #{folioStr}
                </p>
                <div className="flex gap-4 text-xs">
                  <p className="text-amber-800">
                    Balance: <span className="font-semibold text-amber-950">{currency(balance, data?.property?.baseCurrency)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Limit: <span>{currency(limit, data?.property?.baseCurrency)}</span>
                  </p>
                  <p className="text-rose-600 font-medium">
                    Over limit: {currency(over, data?.property?.baseCurrency)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setResolutionAction({ type: 'FOLIO_PREVIEW', item: hb })} 
                className="shrink-0 text-xs font-medium text-amber-800 hover:text-amber-950 bg-amber-100/50 hover:bg-amber-100 px-4 py-2 rounded-md transition-colors"
              >
                Review Folio
              </button>
            </div>
          );
        })}
      </div>
    </div>}
    {data.financial.rateVariances?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-amber-700">Rate Variances</h4>
        <p className="text-xs text-amber-600/80 mt-0.5">Room rates that deviate from their base reservation amount.</p>
      </div>
      <div className="space-y-2">
        {data.financial.rateVariances.map((rv: any) => (
          <div key={rv.id} className="text-sm p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-amber-900">Reservation #{rv.folio?.reservationId?.slice(0, 8) || 'Unknown'}</p>
              <p className="text-xs text-amber-700">Base: {currency(Number(rv.baseAmount), data?.property?.baseCurrency)} / Posted: <span className="font-semibold">{currency(Number(rv.unitAmount), data?.property?.baseCurrency)}</span></p>
            </div>
            <button onClick={() => setResolutionAction({ type: 'FOLIO_PREVIEW', item: { id: rv.folioId, folioNumber: rv.folioNumber, balance: rv.varianceAmount } })} className="text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-50 px-3 py-1.5 rounded-md transition-colors">Review</button>
          </div>
        ))}
      </div>
    </div>}
    {!data.financial.highBalances?.length && !data.financial.rateVariances?.length && (
      <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-2 shadow-sm"><CheckCircle2 className="h-4 w-4" /> No financial anomalies detected.</div>
    )}
  </div>
)}

{step === 3 && data?.cash && (
  <div className="space-y-6 border-t pt-4">
    {data.cash.cashHandovers?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-rose-700">Pending Cash Handovers (Blocker)</h4>
        <p className="text-xs text-rose-600/80 mt-0.5">Cash drawers must be physically handed over and reconciled in the system before closing.</p>
      </div>
      <div className="space-y-2">
        {data.cash.cashHandovers.map((ch: any) => (
          <div key={ch.id} className="text-sm p-3 bg-white rounded-lg border border-rose-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-rose-900">{ch.drawerName || 'Pending Handover'}</p>
              <p className="text-xs text-rose-600">Pending Handover</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-rose-700">{currency(Number(ch.amount), data?.property?.baseCurrency)}</span>
              <button 
                onClick={() => setResolutionAction({ type: 'CASH_HANDOVER', item: { ...ch, propertyId } })}
                className="text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-md transition-colors"
              >
                Action
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>}
    {data.cash.bankDeposits?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-amber-700">Pending Bank Deposits</h4>
        <p className="text-xs text-amber-600/80 mt-0.5">Review cash drops that have not yet been batched for bank deposit.</p>
      </div>
      <div className="space-y-2">
        {data.cash.bankDeposits.map((bd: any) => (
          <div key={bd.id} className="text-sm p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="font-medium text-amber-900">Reference: {bd.reference}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-semibold text-amber-700">{currency(Number(bd.amount), data?.property?.baseCurrency)}</span>
              <a href="/finance/deposits" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-50 px-3 py-1.5 rounded-md transition-colors">Review</a>
            </div>
          </div>
        ))}
      </div>
    </div>}
    {data.cash.unverifiedTransactions?.length > 0 && <div>
      <div className="mb-3">
        <h4 className="font-semibold text-sm text-rose-700">Pending Transaction Verifications (Blocker)</h4>
        <p className="text-xs text-rose-600/80 mt-0.5">The Night Auditor must verify all POS and Bank Transfer receipts submitted to the cashier per shift.</p>
      </div>
      <div className="space-y-2">
        <div className="text-sm p-3 bg-white rounded-lg border border-rose-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="font-medium text-rose-900">{data.cash.unverifiedTransactions.length} Unverified Transactions</p>
            <p className="text-xs text-rose-600">Pending verification</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setResolutionAction({ type: 'TRANSACTION_VERIFICATION', item: { unverifiedTransactions: data.cash.unverifiedTransactions, propertyId } })}
              className="text-xs font-medium text-rose-700 hover:text-rose-900 bg-rose-50 px-3 py-1.5 rounded-md transition-colors"
            >
              Verify Transactions
            </button>
          </div>
        </div>
      </div>
    </div>}
    {!data.cash.cashHandovers?.length && !data.cash.bankDeposits?.length && !data.cash.unverifiedTransactions?.length && (
      <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-2 shadow-sm"><CheckCircle2 className="h-4 w-4" /> All cash handling, deposits, and transactions are verified.</div>
    )}
  </div>
)}

</div> : <div className="flex h-full min-h-[210px] flex-col items-center justify-center text-center"><div className="rounded-2xl bg-emerald-100 p-4 text-emerald-600 dark:bg-emerald-500/10"><ShieldCheck className="h-10 w-10" /></div>

{step === 4 && requiredAcks.length > 0 && (
  <div className="w-full mt-6 space-y-4 text-left">
    <h4 className="font-semibold text-lg">Required Acknowledgements</h4>
    {requiredAcks.map(ack => (
      <div key={ack.type} className="p-4 border rounded-xl bg-white dark:bg-slate-900">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h5 className="font-medium">{ack.title}</h5>
            <p className="text-sm text-muted-foreground">{ack.desc}</p>
          </div>
          {acks[ack.type] && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        </div>
        {!acks[ack.type] && (
          <div className="space-y-3 mt-3">
            <textarea placeholder="Reason (Required)" required className="w-full rounded-md border border-input px-3 py-2 text-sm" value={ackInputs[ack.type]?.reason || ''} onChange={e => setAckInputs(prev => ({...prev, [ack.type]: {...prev[ack.type], reason: e.target.value}}))} />
            <textarea placeholder="Comment (Optional)" className="w-full rounded-md border border-input px-3 py-2 text-sm" value={ackInputs[ack.type]?.comment || ''} onChange={e => setAckInputs(prev => ({...prev, [ack.type]: {...prev[ack.type], comment: e.target.value}}))} />
            <Button onClick={() => handleAck(ack.type)} disabled={acking[ack.type]}>{acking[ack.type] ? 'Acknowledging...' : 'Acknowledge'}</Button>
          </div>
        )}
      </div>
    ))}
  </div>
)}
<p className="mt-4 text-xl font-semibold">{isReady ? 'Ready to close this business day' : 'Resolve blockers before closing'}</p><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Posting charges and rolling the date is recorded against your auditor profile and cannot be undone.</p></div>}</div><DialogFooter className="mt-8 border-t pt-6"><Button variant="ghost" onClick={recheck} disabled={rechecking}><RefreshCw className={`mr-2 h-4 w-4 ${rechecking ? 'animate-spin' : ''}`} />{rechecking ? 'Rechecking…' : 'Refresh and recheck'}</Button><Button variant="outline" onClick={() => setWizardOpen(false)}>Exit flow</Button>{step < steps.length - 1 ? <Button onClick={() => setStep(step + 1)} className="bg-indigo-600 px-6 hover:bg-indigo-700">Continue <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button disabled={!isReady || !rechecked || executing || !['PENDING', 'OVERDUE', 'FAILED'].includes(auditState) || Object.keys(acks).length < requiredAcks.length} onClick={execute} className="bg-indigo-600 px-6 hover:bg-indigo-700">{executing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Closing day...</> : <><Play className="mr-2 h-4 w-4" />{rechecked ? 'Close business day' : 'Recheck before closing'}</>}</Button>}</DialogFooter></div></div></DialogContent></Dialog>
  
  
    </div>;
}
