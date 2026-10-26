'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileSearch,
  FileText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  BadgePercent,
  CalendarRange,
  SlidersHorizontal,
  Activity,
  Scale,
  Clock,
  TrendingDown,
  ChevronRight,
  Layers,
  PieChart as PieChartIcon,
  BookOpen,
  Flag,
  UploadCloud,
  ClipboardList,
  GitCompareArrows,
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

type Scope = {
  propertyId: string;
  propertyName: string;
  currency: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
};
type Dashboard = {
  scope: Scope;
  kpis: {
    totalRevenue: number;
    cashCollected: number;
    averageOccupancy: number;
    adr: number;
    reconciliationStatus: string;
    closeFinalizedAt: string | null;
  };
  controls: { discountAmount: number; complimentaryAmount: number };
  exceptions: Array<{ key: string; label: string; count: number; risk: string }>;
  trend: Array<{
    date: string;
    revenue: number;
    occupancy: number;
    adr: number;
    revpar: number;
    status: string;
    exceptions: number;
  }>;
  revenueMix: Array<{ category: string; name: string; amount: number }>;
  review: { evidenceRecords: number; journalEntries: number; auditEvents: number };
};

const PALETTE = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb923c'];
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' });

type PeriodKey = 'engagement' | 'today' | '7d' | 'mtd' | 'ytd' | 'custom';

const dateKey = (value: Date) => {
  const y = value.getFullYear();
  const m = `${value.getMonth() + 1}`.padStart(2, '0');
  const d = `${value.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);
const startOfYear = (value: Date) => new Date(value.getFullYear(), 0, 1);
const formatPeriod = (start: string, end: string) =>
  `${new Date(`${start}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(`${end}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;

const RISK_COLORS: Record<string, string> = {
  HIGH: '#f43f5e',
  MEDIUM: '#f59e0b',
  LOW: '#34d399',
};

// Custom tooltip for Recharts
function AuditTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ea-tooltip">
      <p className="ea-tooltip-label">{label ? new Date(String(label)).toLocaleDateString() : ''}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="ea-tooltip-row" style={{ color: entry.color }}>
          <span>{entry.name === 'revenue' ? 'Revenue' : entry.name === 'occupancy' ? 'Occupancy' : entry.name}</span>
          <span>
            {entry.name === 'revenue'
              ? money(entry.value, currency)
              : entry.name === 'occupancy'
                ? `${entry.value.toFixed(1)}%`
                : compact.format(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function ExternalAuditorDashboard() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('engagement');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const periodRange = (key: PeriodKey, scope?: Scope) => {
    const today = new Date();
    if (key === 'engagement' && scope)
      return { start: scope.auditPeriodStart.slice(0, 10), end: scope.auditPeriodEnd.slice(0, 10) };
    if (key === 'today') return { start: dateKey(today), end: dateKey(today) };
    if (key === '7d') {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: dateKey(start), end: dateKey(today) };
    }
    if (key === 'mtd') return { start: dateKey(startOfMonth(today)), end: dateKey(today) };
    if (key === 'ytd') return { start: dateKey(startOfYear(today)), end: dateKey(today) };
    return { start: customStart, end: customEnd };
  };

  const load = (propertyId: string, selectedPeriod = period, selectedStart = customStart, selectedEnd = customEnd) => {
    const selectedScope = scopes.find((item) => item.propertyId === propertyId);
    const range =
      selectedPeriod === 'custom' ? { start: selectedStart, end: selectedEnd } : periodRange(selectedPeriod, selectedScope);
    const params = new URLSearchParams({ propertyId });
    if (range.start) params.set('startDate', range.start);
    if (range.end) params.set('endDate', range.end);
    setLoading(true);
    setError('');
    void fetch(`/api/v1/external-auditor/dashboard?${params}`)
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw new Error(value.error || 'Unable to load engagement');
        return value;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void fetch('/api/v1/external-auditor/context')
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok || !value.scopes?.length) throw new Error(value.error || 'No active engagement');
        setScopes(value.scopes);
        const first = value.scopes[0] as Scope;
        load(first.propertyId, 'engagement');
      })
      .catch((e) => setError(e.message));
  }, []);

  const exceptionTotal = useMemo(() => data?.exceptions.reduce((sum, item) => sum + item.count, 0) || 0, [data]);
  const highRiskCount = useMemo(
    () => data?.exceptions.filter((e) => e.risk === 'HIGH' && e.count > 0).length || 0,
    [data],
  );
  const revenueTrend = useMemo(() => {
    if (!data?.trend.length) return null;
    const last = data.trend[data.trend.length - 1];
    const prev = data.trend[data.trend.length - 2];
    if (!prev || prev.revenue === 0) return null;
    return ((last.revenue - prev.revenue) / prev.revenue) * 100;
  }, [data]);

  if (error)
    return (
      <div className="ea-error-card">
        <div className="ea-error-icon">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="ea-error-title">Unable to load audit workspace</p>
          <p className="ea-error-desc">{error}</p>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="ea-loading">
        <div className="ea-loading-spinner" />
        <p>Loading secure audit workspace…</p>
      </div>
    );

  const { kpis, scope } = data;
  const isReconciled = kpis.reconciliationStatus === 'COMPLETED';
  const closeLabel = isReconciled ? 'Reconciled' : kpis.reconciliationStatus.replaceAll('_', ' ');
  const currentRange = periodRange(period, scope);
  const displayRange = formatPeriod(
    currentRange.start || scope.auditPeriodStart.slice(0, 10),
    currentRange.end || scope.auditPeriodEnd.slice(0, 10),
  );

  return (
    <div className="ea-root">
      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div className="ea-page-header">
        <div className="ea-page-header-left">
          <div className="ea-badge-verified">
            <ShieldCheck className="h-3 w-3" />
            Independent Audit Workspace · Read-only access
          </div>
          <h1 className="ea-page-title">Audit Command Center</h1>
          <p className="ea-page-subtitle">
            Financial integrity overview for <strong>{scope.propertyName}</strong> — {displayRange}
          </p>
        </div>
        <div className="ea-page-header-right">
          {scopes.length > 1 && (
            <select
              value={scope.propertyId}
              onChange={(e) => {
                setPeriod('engagement');
                load(e.target.value, 'engagement');
              }}
              className="ea-select"
            >
              {scopes.map((item) => (
                <option key={item.propertyId} value={item.propertyId}>
                  {item.propertyName}
                </option>
              ))}
            </select>
          )}
          <Link href={`/external-auditor/evidence?propertyId=${scope.propertyId}`} className="ea-btn-ghost">
            <FileSearch className="h-4 w-4" />
            Evidence
          </Link>
          <Link href={`/external-auditor/reports?propertyId=${scope.propertyId}`} className="ea-btn-primary">
            <FileText className="h-4 w-4" />
            Reports
          </Link>
        </div>
      </div>

      {/* ── PERIOD FILTER ────────────────────────────────────────────── */}
      <div className="ea-period-bar">
        <div className="ea-period-bar-info">
          <CalendarRange className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <span className="ea-period-label">
              {period === 'engagement'
                ? 'Full Engagement Period'
                : period === 'custom'
                  ? 'Custom Review Window'
                  : 'Preset Window'}
            </span>
            <span className="ea-period-range">· {displayRange}</span>
          </div>
        </div>
        <div className="ea-period-tabs">
          {(
            [
              ['engagement', 'Engagement'],
              ['today', 'Today'],
              ['7d', '7 Days'],
              ['mtd', 'MTD'],
              ['ytd', 'YTD'],
            ] as [PeriodKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPeriod(key);
                load(scope.propertyId, key);
              }}
              className={`ea-period-tab ${period === key ? 'ea-period-tab--active' : ''}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`ea-period-tab ea-period-tab--custom ${period === 'custom' ? 'ea-period-tab--active' : ''}`}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Custom
          </button>
        </div>
      </div>
      {period === 'custom' && (
        <div className="ea-custom-range">
          <label className="ea-custom-range-label">
            From
            <input
              type="date"
              value={customStart}
              min={scope.auditPeriodStart.slice(0, 10)}
              max={scope.auditPeriodEnd.slice(0, 10)}
              onChange={(e) => setCustomStart(e.target.value)}
              className="ea-date-input"
            />
          </label>
          <label className="ea-custom-range-label">
            To
            <input
              type="date"
              value={customEnd}
              min={scope.auditPeriodStart.slice(0, 10)}
              max={scope.auditPeriodEnd.slice(0, 10)}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="ea-date-input"
            />
          </label>
          <button
            type="button"
            disabled={!customStart || !customEnd || customStart > customEnd}
            onClick={() => load(scope.propertyId, 'custom', customStart, customEnd)}
            className="ea-btn-apply"
          >
            Apply range
          </button>
        </div>
      )}

      {/* ── KPI BENTO GRID ───────────────────────────────────────────── */}
      <div className="ea-kpi-grid">
        {/* Audited Revenue */}
        <div className="ea-kpi-card">
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Audited Revenue</span>
            <div className="ea-kpi-icon ea-kpi-icon--green">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="ea-kpi-value">{money(kpis.totalRevenue, scope.currency)}</p>
          <div className="ea-kpi-footer">
            {revenueTrend !== null ? (
              <span className={`ea-kpi-trend ${revenueTrend >= 0 ? 'ea-kpi-trend--up' : 'ea-kpi-trend--down'}`}>
                {revenueTrend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(revenueTrend).toFixed(1)}% vs prior day
              </span>
            ) : (
              <span className="ea-kpi-sub">Across authorized engagement</span>
            )}
          </div>
        </div>

        {/* Average Occupancy */}
        <div className="ea-kpi-card">
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Avg. Occupancy</span>
            <div className="ea-kpi-icon ea-kpi-icon--blue">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <p className="ea-kpi-value">{kpis.averageOccupancy.toFixed(1)}%</p>
          <div className="ea-kpi-footer">
            <div className="ea-occupancy-bar-wrap">
              <div className="ea-occupancy-bar">
                <div className="ea-occupancy-fill" style={{ width: `${Math.min(kpis.averageOccupancy, 100)}%` }} />
              </div>
              <span className="ea-kpi-sub">{kpis.averageOccupancy < 70 ? 'Below target' : 'On track'}</span>
            </div>
          </div>
        </div>

        {/* Cash Collected */}
        <div className="ea-kpi-card">
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Cash Collected</span>
            <div className="ea-kpi-icon ea-kpi-icon--violet">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="ea-kpi-value">{money(kpis.cashCollected, scope.currency)}</p>
          <div className="ea-kpi-footer">
            <span className="ea-kpi-sub">
              {kpis.totalRevenue > 0 ? `${((kpis.cashCollected / kpis.totalRevenue) * 100).toFixed(1)}% of total revenue` : 'Verified cash receipts'}
            </span>
          </div>
        </div>

        {/* ADR */}
        <div className="ea-kpi-card">
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Average Daily Rate</span>
            <div className="ea-kpi-icon ea-kpi-icon--amber">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <p className="ea-kpi-value">{money(kpis.adr, scope.currency)}</p>
          <div className="ea-kpi-footer">
            <span className="ea-kpi-sub">Per occupied room night</span>
          </div>
        </div>

        {/* Close Status */}
        <div className={`ea-kpi-card ea-kpi-card--status ${isReconciled ? 'ea-kpi-card--reconciled' : 'ea-kpi-card--pending'}`}>
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Night Audit Status</span>
            {isReconciled ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <Clock className="h-5 w-5 text-amber-400" />
            )}
          </div>
          <p className={`ea-kpi-value ea-kpi-value--status ${isReconciled ? 'ea-kpi-value--reconciled' : 'ea-kpi-value--pending'}`}>
            {closeLabel}
          </p>
          <div className="ea-kpi-footer">
            <span className="ea-kpi-sub">
              {kpis.closeFinalizedAt
                ? `Closed ${new Date(kpis.closeFinalizedAt).toLocaleDateString()}`
                : 'Awaiting close finalization'}
            </span>
          </div>
        </div>

        {/* Exception Summary */}
        <div className={`ea-kpi-card ea-kpi-card--exceptions ${exceptionTotal > 0 ? 'ea-kpi-card--has-exceptions' : ''}`}>
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Active Exceptions</span>
            <div className={`ea-kpi-icon ${exceptionTotal > 0 ? (highRiskCount > 0 ? 'ea-kpi-icon--red' : 'ea-kpi-icon--amber') : 'ea-kpi-icon--green'}`}>
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <p className={`ea-kpi-value ${exceptionTotal > 0 ? (highRiskCount > 0 ? 'text-rose-400' : 'text-amber-400') : 'text-emerald-400'}`}>
            {exceptionTotal}
          </p>
          <div className="ea-kpi-footer">
            {highRiskCount > 0 ? (
              <span className="ea-badge-risk-high">{highRiskCount} HIGH priority</span>
            ) : exceptionTotal > 0 ? (
              <span className="ea-badge-risk-med">Requires review</span>
            ) : (
              <span className="ea-badge-risk-ok">All clear</span>
            )}
          </div>
        </div>

        {/* Audit Coverage */}
        <div className="ea-kpi-card">
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Evidence Records</span>
            <div className="ea-kpi-icon ea-kpi-icon--teal">
              <FileSearch className="h-4 w-4" />
            </div>
          </div>
          <p className="ea-kpi-value">{data.review.evidenceRecords.toLocaleString()}</p>
          <div className="ea-kpi-footer">
            <span className="ea-kpi-sub">
              {data.review.journalEntries.toLocaleString()} journal lines · {data.review.auditEvents.toLocaleString()} events
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="ea-kpi-card">
          <div className="ea-kpi-card-header">
            <span className="ea-kpi-label">Control Exposure</span>
            <div className="ea-kpi-icon ea-kpi-icon--orange">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="ea-kpi-value">
            {money(data.controls.discountAmount + data.controls.complimentaryAmount, scope.currency)}
          </p>
          <div className="ea-kpi-footer">
            <span className="ea-kpi-sub">
              Discounts + Complimentary · {money(data.controls.discountAmount, scope.currency)} / {money(data.controls.complimentaryAmount, scope.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW ───────────────────────────────────────────────── */}
      <div className="ea-charts-row">
        {/* Revenue & Occupancy Trend */}
        <div className="ea-chart-card ea-chart-card--wide">
          <div className="ea-chart-header">
            <div>
              <p className="ea-chart-eyebrow">Operating Signal</p>
              <h2 className="ea-chart-title">Revenue & Occupancy Trend</h2>
            </div>
            <div className="ea-chart-legend">
              <span className="ea-legend-dot" style={{ background: '#34d399' }} />
              <span>Revenue</span>
              <span className="ea-legend-dot" style={{ background: '#38bdf8' }} />
              <span>Occupancy</span>
            </div>
          </div>
          <div className="ea-chart-body">
            {data.trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ffffff0d" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={date}
                    tick={{ fill: '#475569', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="revenue"
                    tickFormatter={(v) => compact.format(v)}
                    tick={{ fill: '#475569', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <YAxis
                    yAxisId="occupancy"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#475569', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip content={<AuditTooltip currency={scope.currency} />} />
                  <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} fill="url(#revGrad)" />
                  <Area yAxisId="occupancy" type="monotone" dataKey="occupancy" stroke="#38bdf8" strokeWidth={2} fill="url(#occGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="ea-chart-empty">No finalized observations in this period.</div>
            )}
          </div>
        </div>

        {/* Revenue Mix Donut */}
        <div className="ea-chart-card ea-chart-card--narrow">
          <div className="ea-chart-header">
            <div>
              <p className="ea-chart-eyebrow">Revenue Composition</p>
              <h2 className="ea-chart-title">By Account</h2>
            </div>
            <PieChartIcon className="h-4 w-4 text-slate-600" />
          </div>
          <div className="ea-chart-body ea-chart-body--short">
            {data.revenueMix.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.revenueMix}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data.revenueMix.map((item, index) => (
                      <Cell key={item.category} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [money(Number(value), scope.currency), String(name)]}
                    contentStyle={{ background: '#0b1628', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="ea-chart-empty">No revenue accounts in this period.</div>
            )}
          </div>
          <div className="ea-mix-list">
            {data.revenueMix.map((item, index) => {
              const total = data.revenueMix.reduce((sum, s) => sum + s.amount, 0);
              const share = total ? (item.amount / total) * 100 : 0;
              return (
                <div key={item.category} className="ea-mix-row">
                  <span className="ea-mix-dot" style={{ background: PALETTE[index % PALETTE.length] }} />
                  <span className="ea-mix-name">{item.name}</span>
                  <span className="ea-mix-pct">{share.toFixed(0)}%</span>
                  <div className="ea-mix-bar-wrap">
                    <div className="ea-mix-bar-fill" style={{ width: `${share}%`, background: PALETTE[index % PALETTE.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── FINANCIAL INTEGRITY + ENGAGEMENT WORKSPACE ───────────────── */}
      <div className="ea-lower-row">

        {/* ── LEFT: Financial Integrity Overview ── */}
        <div className="ea-panel">
          <div className="ea-panel-header">
            <div>
              <p className="ea-chart-eyebrow">Financial Integrity</p>
              <h2 className="ea-chart-title">Transaction Risk Signals</h2>
              <p className="ea-panel-sub">Real-time flags derived from posted ledger activity across the authorized period.</p>
            </div>
            <Link href={`/external-auditor/assurance?propertyId=${scope.propertyId}`} className="ea-link-arrow">
              Reconciliation center
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Risk signal rows */}
          <div className="ea-integrity-table">
            {data.exceptions.map((item) => {
              const hasIssue = item.count > 0;
              const color = hasIssue ? (RISK_COLORS[item.risk] || '#94a3b8') : '#34d399';
              return (
                <Link
                  key={item.key}
                  href={
                    item.key === 'discounts' || item.key === 'complimentary'
                      ? `/external-auditor/controls?propertyId=${scope.propertyId}&kind=${item.key}`
                      : `/external-auditor/evidence?propertyId=${scope.propertyId}&q=${encodeURIComponent(item.label)}`
                  }
                  className="ea-integrity-row"
                >
                  <span className="ea-integrity-dot" style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
                  <span className="ea-integrity-name">{item.label}</span>
                  <span className="ea-integrity-risk" style={{ color, background: `${color}12` }}>{item.risk}</span>
                  <span className="ea-integrity-count" style={{ color: hasIssue ? color : '#475569' }}>
                    {item.count.toLocaleString()}
                  </span>
                  <ChevronRight className="ea-integrity-arrow" />
                </Link>
              );
            })}
          </div>

          {/* Daily exception bar chart */}
          {data.trend.length > 0 && (
            <div>
              <p className="ea-chart-eyebrow" style={{ marginBottom: '0.75rem' }}>Daily Exception Frequency</p>
              <div style={{ height: 110 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={8}>
                    <CartesianGrid stroke="#ffffff08" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      tick={{ fill: '#475569', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: '#0b1628', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, fontSize: 12 }}
                      formatter={(v: number) => [v, 'Exceptions']}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                    />
                    <Bar dataKey="exceptions" radius={[4, 4, 0, 0]}>
                      {data.trend.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.exceptions > 0 ? (entry.exceptions > 3 ? '#f43f5e' : '#f59e0b') : '#34d399'}
                          opacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Engagement Workspace ── */}
        <div className="ea-panel-stack">

          {/* Fieldwork Counters */}
          <div className="ea-engage-card">
            <div className="ea-engage-header">
              <ClipboardList className="h-4 w-4 text-emerald-400" />
              <span className="ea-engage-title">Engagement Fieldwork</span>
            </div>
            <div className="ea-engage-stats">
              <Link href={`/external-auditor/operations?tab=findings&propertyId=${scope.propertyId}`} className="ea-engage-stat">
                <div className="ea-engage-stat-icon" style={{ background: 'rgba(244,63,94,.1)', color: '#f43f5e' }}>
                  <Flag className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="ea-engage-stat-label">Findings</p>
                  <p className="ea-engage-stat-value">—</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-700 ml-auto" />
              </Link>
              <Link href={`/external-auditor/operations?tab=workpapers&propertyId=${scope.propertyId}`} className="ea-engage-stat">
                <div className="ea-engage-stat-icon" style={{ background: 'rgba(167,139,250,.1)', color: '#a78bfa' }}>
                  <BookOpen className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="ea-engage-stat-label">Workpapers</p>
                  <p className="ea-engage-stat-value">—</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-700 ml-auto" />
              </Link>
              <Link href={`/external-auditor/operations?tab=requests&propertyId=${scope.propertyId}`} className="ea-engage-stat">
                <div className="ea-engage-stat-icon" style={{ background: 'rgba(56,189,248,.1)', color: '#38bdf8' }}>
                  <UploadCloud className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="ea-engage-stat-label">Evidence Requests</p>
                  <p className="ea-engage-stat-value">—</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-700 ml-auto" />
              </Link>
            </div>
          </div>

          {/* Controls Exposure */}
          <div className="ea-engage-card">
            <div className="ea-engage-header">
              <BadgePercent className="h-4 w-4 text-amber-400" />
              <span className="ea-engage-title">Revenue Controls Exposure</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.5rem' }}>
              <Link
                href={`/external-auditor/controls?propertyId=${scope.propertyId}&kind=discounts`}
                className="ea-ctrl-row"
              >
                <span className="ea-ctrl-dot" style={{ background: '#f59e0b' }} />
                <span className="ea-ctrl-label">Discounts Granted</span>
                <span className="ea-ctrl-amount">{money(data.controls.discountAmount, scope.currency)}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
              </Link>
              <Link
                href={`/external-auditor/controls?propertyId=${scope.propertyId}&kind=complimentary`}
                className="ea-ctrl-row"
              >
                <span className="ea-ctrl-dot" style={{ background: '#a78bfa' }} />
                <span className="ea-ctrl-label">Complimentary Value</span>
                <span className="ea-ctrl-amount">{money(data.controls.complimentaryAmount, scope.currency)}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
              </Link>
              <div className="ea-ctrl-row" style={{ cursor: 'default' }}>
                <span className="ea-ctrl-dot" style={{ background: isReconciled ? '#34d399' : '#f59e0b' }} />
                <span className="ea-ctrl-label">Reconciliation</span>
                <span className="ea-ctrl-amount" style={{ color: isReconciled ? '#34d399' : '#f59e0b', textTransform: 'capitalize' }}>
                  {closeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Navigate */}
          <div className="ea-engage-card">
            <div className="ea-engage-header">
              <GitCompareArrows className="h-4 w-4 text-sky-400" />
              <span className="ea-engage-title">Quick Navigate</span>
            </div>
            <div className="ea-quicknav-grid">
              {[
                { label: 'Evidence', href: `/external-auditor/evidence?propertyId=${scope.propertyId}`, color: '#38bdf8', icon: FileSearch },
                { label: 'Reports', href: `/external-auditor/reports?propertyId=${scope.propertyId}`, color: '#34d399', icon: FileText },
                { label: 'Assurance', href: `/external-auditor/assurance?propertyId=${scope.propertyId}`, color: '#a78bfa', icon: GitCompareArrows },
                { label: 'Operations', href: `/external-auditor/operations?propertyId=${scope.propertyId}`, color: '#fbbf24', icon: ClipboardList },
              ].map(({ label, href, color, icon: Icon }) => (
                <Link key={label} href={href} className="ea-quicknav-tile" style={{ '--ea-qn-color': color } as React.CSSProperties}>
                  <Icon className="h-4 w-4" style={{ color }} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── ENGAGEMENT METRICS BAR ───────────────────────────────────── */}
      <div className="ea-metrics-bar">
        <Link href={`/external-auditor/evidence?propertyId=${scope.propertyId}`} className="ea-metric-tile">
          <FileSearch className="h-4 w-4 text-sky-400" />
          <div>
            <p className="ea-metric-value">{data.review.evidenceRecords.toLocaleString()}</p>
            <p className="ea-metric-label">Evidence Records</p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-700 ml-auto" />
        </Link>
        <Link href={`/external-auditor/reports?propertyId=${scope.propertyId}`} className="ea-metric-tile">
          <BarChart3 className="h-4 w-4 text-violet-400" />
          <div>
            <p className="ea-metric-value">{data.review.journalEntries.toLocaleString()}</p>
            <p className="ea-metric-label">Journal Entries</p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-700 ml-auto" />
        </Link>
        <div className="ea-metric-tile">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="ea-metric-value">{data.review.auditEvents.toLocaleString()}</p>
            <p className="ea-metric-label">Audit Events Logged</p>
          </div>
        </div>
        <Link href={`/external-auditor/engagement?propertyId=${scope.propertyId}`} className="ea-metric-tile">
          <CalendarDays className="h-4 w-4 text-emerald-300" />
          <div>
            <p className="ea-metric-value">{displayRange}</p>
            <p className="ea-metric-label">Audit Period</p>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-700 ml-auto" />
        </Link>
      </div>

      {loading && (
        <p className="ea-refresh-indicator">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Refreshing engagement data…
        </p>
      )}
    </div>
  );
}
