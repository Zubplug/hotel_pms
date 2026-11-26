'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  BedDouble,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Loader2,
  LogIn,
  LogOut,
  MoonStar,
  Play,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NightAuditData } from '@/types/night-audit';
import { money } from './ui';

const SURFACE = 'rgba(8,15,29,0.78)';
const BORDER = 'rgba(255,255,255,0.08)';

function shortMoney(value: number, currency: string) {
  return money(value, currency, true);
}

function statusFor(data: NightAuditData) {
  if (data.auditState === 'COMPLETED') return { label: 'Business day closed', color: '#34d399', icon: CheckCircle2 };
  if (data.auditState === 'COMPLETED_WITH_EXCEPTIONS') return { label: 'Closed with exceptions', color: '#fbbf24', icon: ShieldAlert };
  if (data.auditState === 'FAILED') return { label: 'Recovery required', color: '#fb7185', icon: XCircle };
  if (data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING') return { label: 'Audit in progress', color: '#38bdf8', icon: Loader2 };
  if (data.auditState === 'OVERDUE') return { label: 'Audit overdue', color: '#fb7185', icon: Clock3 };
  return { label: data.canStartAudit ? 'Ready to begin' : 'Awaiting controls', color: '#a78bfa', icon: data.canStartAudit ? Play : Clock3 };
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[22px] border ${className}`} style={{ background: SURFACE, borderColor: BORDER, boxShadow: '0 18px 55px -30px rgba(0,0,0,0.9)' }}>{children}</section>;
}

function PanelTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, color }: { label: string; value: string; detail: string; icon: React.ElementType; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: 'rgba(255,255,255,0.025)', borderColor: `${color}24` }}>
      <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: `${color}18` }} />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <p className="relative mt-3 text-[22px] font-semibold tracking-tight text-white">{value}</p>
      <p className="relative mt-1 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label, currency }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; name: string; value: number; color: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border px-3 py-2 shadow-2xl" style={{ background: '#070b14', borderColor: 'rgba(255,255,255,0.12)' }}>
      <p className="mb-1 text-[10px] font-semibold text-slate-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs font-semibold" style={{ color: entry.color }}>
          {entry.name}: {entry.dataKey === 'revenue' ? money(Number(entry.value), currency) : `${Number(entry.value).toFixed(0)}%`}
        </p>
      ))}
    </div>
  );
}

export function NightAuditOverview({
  data,
  refreshing,
  managerMode,
  onOpenWizard,
  onRefresh,
}: {
  data: NightAuditData;
  refreshing: boolean;
  managerMode: boolean;
  onOpenWizard: () => void;
  onRefresh: () => void;
}) {
  const currency = data.property.baseCurrency;
  const status = statusFor(data);
  const StatusIcon = status.icon;
  const rooms = data.analytics.rooms;
  const occupancy = rooms.total ? Math.round((rooms.occupied / rooms.total) * 100) : 0;
  const trend = (data.analytics.trend || []).slice(-14).map((point) => ({
    date: format(new Date(point.businessDate), 'dd MMM'),
    revenue: Number(point.totalRevenue || 0),
    occupancy: Number(point.occupancy || 0),
  }));
  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  const revenue = Number(latest?.revenue || data.analytics.revenue || 0);
  const revenueDelta = previous?.revenue ? ((revenue - previous.revenue) / previous.revenue) * 100 : null;
  const snapshot = data.financialSnapshot || data.currentAudit?.financialSnapshot || {};
  const revenueMix = [
    { name: 'Rooms', value: Number(snapshot.roomRevenue || 0), color: '#a78bfa' },
    { name: 'F&B / POS', value: Number(snapshot.fnbRevenue || 0), color: '#fbbf24' },
    { name: 'Other', value: Number(snapshot.otherRevenue || 0), color: '#38bdf8' },
  ].filter((item) => item.value > 0);
  const blockers = data.summary.blockers || 0;
  const warnings = data.summary.warnings || 0;
  const isRunning = data.auditState === 'IN_PROGRESS' || data.auditState === 'POSTING';
  const isClosed = data.auditState === 'COMPLETED' || data.auditState === 'COMPLETED_WITH_EXCEPTIONS';
  const steps = [
    { label: 'Controls', done: data.summary.blockers === 0, active: !isClosed && !isRunning },
    { label: 'Post charges', done: isClosed, active: isRunning },
    { label: 'Reconcile', done: isClosed, active: false },
    { label: 'Roll date', done: isClosed, active: false },
  ];

  return (
    <div className="space-y-5">
      <Panel className="relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 45% 120% at 0% 0%, ${status.color}14, transparent 70%)` }} />
        <div className="relative flex flex-col gap-6 px-5 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-7">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border" style={{ background: `${status.color}12`, borderColor: `${status.color}45`, boxShadow: `0 0 30px -8px ${status.color}80` }}>
              <MoonStar className="h-6 w-6" style={{ color: status.color }} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Night operations / control room</p>
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold" style={{ borderColor: `${status.color}40`, background: `${status.color}12`, color: status.color }}>
                  <StatusIcon className={`h-3 w-3 ${isRunning ? 'animate-spin' : ''}`} /> {status.label}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Close the business day with confidence.</h1>
              <p className="mt-2 text-sm text-slate-400">{data.property.name} <span className="mx-1 text-slate-700">/</span> Business date <span className="font-semibold text-slate-200">{format(new Date(data.businessDate), 'EEEE, dd MMM yyyy')}</span></p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50" style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.03)' }}>
              <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {!managerMode && !isClosed && (
              <button onClick={onOpenWizard} disabled={isRunning || !(data.canStartAudit || data.canResumeAudit)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: status.color }}>
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {isRunning ? 'Audit running' : data.auditState === 'OVERDUE' ? 'Run audit now' : 'Open audit wizard'}
              </button>
            )}
          </div>
        </div>
        <div className="relative grid grid-cols-2 border-t sm:grid-cols-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center gap-2.5 border-r px-5 py-3 last:border-r-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full border" style={{ borderColor: step.done || step.active ? `${status.color}70` : BORDER, background: step.done ? status.color : step.active ? `${status.color}20` : 'transparent' }}>
                {step.done ? <Check className="h-3.5 w-3.5 text-slate-950" strokeWidth={3} /> : <span className="text-[10px] font-bold" style={{ color: step.active ? status.color : '#64748b' }}>0{index + 1}</span>}
              </span>
              <div><p className="text-[11px] font-semibold text-slate-300">{step.label}</p><p className="text-[9px] uppercase tracking-wider" style={{ color: step.active ? status.color : '#64748b' }}>{step.done ? 'Complete' : step.active ? 'Current' : 'Pending'}</p></div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Revenue today" value={shortMoney(revenue, currency)} detail={revenueDelta === null ? 'Current audit period' : `${revenueDelta >= 0 ? '+' : ''}${revenueDelta.toFixed(1)}% vs prior day`} icon={CircleDollarSign} color="#a78bfa" />
        <Metric label="Occupancy" value={`${occupancy}%`} detail={`${rooms.occupied} occupied · ${rooms.available} available`} icon={BedDouble} color="#38bdf8" />
        <Metric label="Payments captured" value={shortMoney(data.analytics.payments || 0, currency)} detail="Posted in this business date" icon={WalletCards} color="#34d399" />
        <Metric label="Attention" value={`${blockers + warnings}`} detail={`${blockers} blockers · ${warnings} warnings`} icon={blockers ? ShieldAlert : CheckCircle2} color={blockers ? '#fb7185' : '#34d399'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]">
        <Panel>
          <PanelTitle eyebrow="Performance curve" title="Revenue and occupancy" action={<span className="text-[10px] text-slate-500">Last {trend.length || 0} business dates</span>} />
          <div className="h-[275px] p-4 sm:p-5">
            {trend.length ? <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
                <defs><linearGradient id="auditRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.32} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="revenue" hide />
                <YAxis yAxisId="occupancy" orientation="right" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Area yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#a78bfa" strokeWidth={2.5} fill="url(#auditRevenueFill)" activeDot={{ r: 4, fill: '#a78bfa', stroke: '#070b14', strokeWidth: 2 }} />
                <Area yAxisId="occupancy" type="monotone" dataKey="occupancy" name="Occupancy" stroke="#38bdf8" strokeWidth={2} fill="none" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-500">Performance history will appear after the first completed audit.</div>}
          </div>
          <div className="flex items-center gap-5 border-t px-5 py-3 text-[10px] text-slate-500" style={{ borderColor: 'rgba(255,255,255,0.06)' }}><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-violet-400" />Revenue</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-sky-400" />Occupancy</span></div>
        </Panel>

        <Panel>
          <PanelTitle eyebrow="Current period" title="Revenue mix" action={<Link href="/night-audit/reconciliation" className="text-[10px] font-semibold text-violet-300 hover:text-violet-200">Reconcile <ChevronRight className="inline h-3 w-3" /></Link>} />
          <div className="flex items-center gap-4 p-5">
            <div className="h-[142px] w-[142px] shrink-0">
              {revenueMix.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={revenueMix} dataKey="value" innerRadius={43} outerRadius={63} paddingAngle={3} strokeWidth={0}>{revenueMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value: number | string) => money(Number(value), currency)} contentStyle={{ background: '#070b14', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 11 }} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-full border border-dashed border-white/10 text-center text-[10px] text-slate-500">No revenue<br />posted</div>}
            </div>
            <div className="min-w-0 flex-1 space-y-3">{revenueMix.map((entry) => <div key={entry.name}><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-[11px] text-slate-400"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />{entry.name}</span><span className="text-[11px] font-semibold text-slate-200">{shortMoney(entry.value, currency)}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${revenue ? Math.min(100, (entry.value / revenue) * 100) : 0}%`, background: entry.color }} /></div></div>)}</div>
          </div>
          <div className="grid grid-cols-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}><div className="px-5 py-3"><p className="text-[9px] uppercase tracking-wider text-slate-500">ADR</p><p className="mt-1 text-sm font-semibold text-white">{shortMoney(Number(latest?.revenue && rooms.occupied ? latest.revenue / rooms.occupied : 0), currency)}</p></div><div className="border-l px-5 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}><p className="text-[9px] uppercase tracking-wider text-slate-500">RevPAR</p><p className="mt-1 text-sm font-semibold text-white">{shortMoney(Number(latest?.revenue && rooms.total ? latest.revenue / rooms.total : 0), currency)}</p></div></div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Panel>
          <PanelTitle eyebrow="Operations pulse" title="Movement and room inventory" action={<Link href="/night-audit/rooms" className="text-[10px] font-semibold text-sky-300 hover:text-sky-200">Open room control <ChevronRight className="inline h-3 w-3" /></Link>} />
          <div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr]">
            <div className="h-[190px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ label: 'Arrivals', value: data.operational.arrivals.length, color: '#818cf8' }, { label: 'Departures', value: data.operational.departures.length, color: '#fbbf24' }, { label: 'In-house', value: data.analytics.inHouseGuests, color: '#34d399' }]} margin={{ top: 8, right: 0, left: -25, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#070b14', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 11 }} /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{[ '#818cf8', '#fbbf24', '#34d399' ].map((color) => <Cell key={color} fill={color} />)}</Bar></BarChart></ResponsiveContainer></div>
            <div className="grid grid-cols-2 gap-2">{[
              { label: 'Arrivals', value: data.operational.arrivals.length, icon: LogIn, color: '#818cf8' },
              { label: 'Departures', value: data.operational.departures.length, icon: LogOut, color: '#fbbf24' },
              { label: 'Occupied', value: rooms.occupied, icon: BedDouble, color: '#38bdf8' },
              { label: 'In-house guests', value: data.analytics.inHouseGuests, icon: Users, color: '#34d399' },
            ].map((item) => <div key={item.label} className="rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}><item.icon className="h-4 w-4" style={{ color: item.color }} /><p className="mt-3 text-xl font-semibold text-white">{item.value}</p><p className="mt-1 text-[10px] text-slate-500">{item.label}</p></div>)}</div>
          </div>
        </Panel>

        <Panel>
          <PanelTitle eyebrow="Exception control" title="Attention queue" action={<Link href="/night-audit/attention" className="text-[10px] font-semibold text-rose-300 hover:text-rose-200">Review all <ChevronRight className="inline h-3 w-3" /></Link>} />
          <div className="p-5">
            <div className="flex items-center gap-4 rounded-2xl border p-4" style={{ borderColor: blockers ? 'rgba(251,113,133,0.25)' : 'rgba(52,211,153,0.2)', background: blockers ? 'rgba(244,63,94,0.06)' : 'rgba(52,211,153,0.05)' }}><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: blockers ? 'rgba(244,63,94,0.12)' : 'rgba(52,211,153,0.12)' }}>{blockers ? <ShieldAlert className="h-5 w-5 text-rose-300" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" />}</div><div><p className="text-sm font-semibold text-white">{blockers ? `${blockers} blocker${blockers === 1 ? '' : 's'} require action` : 'No blocking exceptions'}</p><p className="mt-1 text-[11px] text-slate-500">{warnings ? `${warnings} warnings remain for review.` : 'The audit control surface is clear.'}</p></div></div>
            <div className="mt-4 space-y-2">{[
              { label: 'System & sync', value: data.system.openPosSessions.length + data.system.openFrontdeskSessions.length + data.system.financialSyncConflicts.length, color: '#fb7185' },
              { label: 'Financial controls', value: data.financial.highBalances.length + data.financial.pendingDiscounts.length + data.financial.pendingCheckInBypasses.length, color: '#fbbf24' },
              { label: 'Operations', value: data.operational.arrivals.length + data.operational.departures.length, color: '#38bdf8' },
            ].map((item) => <div key={item.label} className="flex items-center justify-between border-b py-2.5 last:border-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}><span className="flex items-center gap-2 text-[11px] text-slate-400"><i className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />{item.label}</span><span className="text-xs font-semibold text-white">{item.value}</span></div>)}</div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-center gap-2 text-[11px] text-slate-500"><Sparkles className="h-3.5 w-3.5 text-violet-300" />The control room refreshes automatically while an audit is running.</div>
        <div className="flex items-center gap-4 text-[10px] text-slate-600"><Link href="/night-audit/activity" className="hover:text-slate-300">Activity intelligence</Link><Link href="/night-audit/history" className="hover:text-slate-300">Audit history</Link></div>
      </div>
    </div>
  );
}
