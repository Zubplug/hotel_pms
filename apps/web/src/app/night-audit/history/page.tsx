'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock, Search, Filter, Download, CheckCircle2, XCircle, Loader2,
  Calendar, User, BedDouble, Banknote, FileText, Coffee, Package,
  CalendarClock, TrendingUp, ShieldCheck, TimerReset, BarChart3,
  ListTree, AlertTriangle, DownloadCloud, FileCheck2, Lock, X,
  ChevronRight, MoonStar, Zap,
} from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { getNightAuditHistory } from '@/lib/night-audit-actions';
import { RoomChargesDialog } from '@/components/night-audit/history/room-charges-dialog';

const formatDuration = (start: string | null, end: string | null) => {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);

/* ── Status badge ──────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    COMPLETED: {
      label: 'Completed',
      icon: <CheckCircle2 className="h-3 w-3" />,
      cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    },
    FAILED: {
      label: 'Failed',
      icon: <XCircle className="h-3 w-3" />,
      cls: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    },
    IN_PROGRESS: {
      label: 'In Progress',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      cls: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300',
    },
    POSTING: {
      label: 'Posting',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      cls: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300',
    },
  };
  const c = config[status] ?? {
    label: status || 'Unknown',
    icon: <Clock className="h-3 w-3" />,
    cls: 'border-slate-600/40 bg-slate-600/15 text-slate-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

export default function AuditHistoryPage() {
  const { propertyId } = useProperty();
  const [history, setHistory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [selectedAudit, setSelectedAudit] = useState<any>(null);
  const [selectedChargesAudit, setSelectedChargesAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propertyId) {
      setLoading(true);
      getNightAuditHistory(propertyId).then((data) => {
        setHistory(data);
        setLoading(false);
      });
    }
  }, [propertyId]);

  // Close filter on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false);
      }
    };
    if (showFilter) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilter]);

  const filteredHistory = useMemo(() => {
    return history.filter((audit) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const auditor = (audit.auditorName || 'SYSTEM').toLowerCase();
        const date = new Date(audit.businessDate).toLocaleDateString().toLowerCase();
        if (!auditor.includes(q) && !date.includes(q)) return false;
      }
      if (dateRange.from && new Date(audit.businessDate) < new Date(dateRange.from)) return false;
      if (dateRange.to && new Date(audit.businessDate) > new Date(dateRange.to)) return false;
      return true;
    });
  }, [history, searchQuery, dateRange]);

  const insights = useMemo(() => {
    const completed = history.filter((a) => a.status === 'COMPLETED');
    const durations = completed
      .map((a) => {
        if (!a.startedAt || !a.completedAt) return 0;
        return Math.max(0, new Date(a.completedAt).getTime() - new Date(a.startedAt).getTime());
      })
      .filter(Boolean);
    const avgMs = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;
    return {
      completed: completed.length,
      total: history.length,
      successRate: history.length ? Math.round((completed.length / history.length) * 100) : 0,
      totalRevenue: completed.reduce((s, a) => s + Number(a.totalRevenue || 0), 0),
      avgDuration: avgMs ? formatDuration(new Date(0).toISOString(), new Date(avgMs).toISOString()) : '—',
      latestRevenue: Number(completed[0]?.totalRevenue || 0),
    };
  }, [history]);

  const exportCsv = () => {
    const header = ['Date', 'Auditor', 'Status', 'Duration', 'Rooms Charged', 'Total Revenue'];
    const rows = filteredHistory.map((a) => [
      new Date(a.businessDate).toLocaleDateString(),
      a.auditorName,
      a.status,
      formatDuration(a.startedAt, a.completedAt),
      a.roomChargesPosted || 0,
      a.totalRevenue || 0,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAuditPack = (audit: any) => {
    if (!audit.closePackage) return;
    const pack = {
      propertyId: audit.propertyId,
      businessDate: audit.businessDate,
      auditor: audit.auditorName,
      status: audit.status,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      financialSnapshot: audit.financialSnapshot,
      closePackage: audit.closePackage,
      acknowledgements: audit.acknowledgements,
      occupancy: { rate: audit.occupancy, adr: audit.adr, revpar: audit.revpar },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_pack_${audit.propertyId}_${new Date(audit.businessDate).toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const STAT_CARDS = [
    {
      label: 'Completion Rate',
      value: `${insights.successRate}%`,
      sub: `${insights.completed} of ${insights.total} runs`,
      icon: ShieldCheck,
      accent: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300',
      iconBg: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-400',
      bar: insights.successRate,
      barColor: '#10b981',
    },
    {
      label: 'Avg Close Time',
      value: insights.avgDuration,
      sub: 'Across completed audits',
      icon: TimerReset,
      accent: 'border-indigo-400/20 bg-indigo-400/[0.07] text-indigo-300',
      iconBg: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-400',
      bar: null,
      barColor: '#6366f1',
    },
    {
      label: 'Audited Revenue',
      value: formatCurrency(insights.totalRevenue),
      sub: 'Cumulative recorded revenue',
      icon: TrendingUp,
      accent: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300',
      iconBg: 'border-amber-400/20 bg-amber-400/10 text-amber-400',
      bar: null,
      barColor: '#f59e0b',
    },
    {
      label: 'Latest Revenue',
      value: formatCurrency(insights.latestRevenue),
      sub: 'Most recent completed date',
      icon: BarChart3,
      accent: 'border-violet-400/20 bg-violet-400/[0.07] text-violet-300',
      iconBg: 'border-violet-400/20 bg-violet-400/10 text-violet-400',
      bar: null,
      barColor: '#8b5cf6',
    },
  ];

  /* ────────────────────────────────────────────────────────── Render ────── */
  return (
    <div
      className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8"
      style={{ background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' }}
    >
      <div className="mx-auto max-w-[1540px] space-y-6">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Night Audit / Records
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/25"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(124,58,237,0.15))', boxShadow: '0 0 24px rgba(99,102,241,0.2)' }}
              >
                <CalendarClock className="h-5 w-5 text-indigo-300" />
              </span>
              Audit History
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Review close performance of every business date, trace accountability, and detect operational drift early.
            </p>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2.5" ref={filterRef}>
            {/* Filter button */}
            <div className="relative">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all ${
                  showFilter || dateRange.from || dateRange.to
                    ? 'border-indigo-400/40 bg-indigo-400/10 text-indigo-300'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filter
                {(dateRange.from || dateRange.to) && (
                  <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                    •
                  </span>
                )}
              </button>

              {showFilter && (
                <div
                  className="absolute right-0 top-full z-30 mt-2 w-[280px] rounded-2xl border border-white/[0.08] p-4 shadow-2xl"
                  style={{ background: '#0f1525' }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Filter Records</h3>
                    <button
                      onClick={() => setShowFilter(false)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {['from', 'to'].map((key) => (
                      <div key={key} className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          {key === 'from' ? 'From Date' : 'To Date'}
                        </label>
                        <input
                          type="date"
                          className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 text-sm text-slate-200 outline-none focus:border-indigo-400/50 focus:ring-0"
                          value={dateRange[key as 'from' | 'to']}
                          onChange={(e) => setDateRange((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button
                        className="flex-1 rounded-xl border border-white/[0.07] py-2 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
                        onClick={() => { setDateRange({ from: '', to: '' }); setShowFilter(false); }}
                      >
                        Clear
                      </button>
                      <button
                        className="flex-1 rounded-xl py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
                        onClick={() => setShowFilter(false)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Export CSV */}
            <button
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-semibold text-slate-400 transition-all hover:bg-white/[0.06] hover:text-slate-200"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAT_CARDS.map(({ label, value, sub, icon: Icon, accent, iconBg, bar, barColor }) => (
            <div
              key={label}
              className={`flex flex-col gap-4 rounded-[20px] border p-5 ${accent}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{sub}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconBg}`}>
                  <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </span>
              </div>
              {bar !== null && (
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${bar}%`, background: barColor }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Main Table Card ─────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-[24px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>

          {/* Card header */}
          <div className="flex flex-col justify-between gap-4 border-b border-white/[0.06] px-6 py-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-white">Past Executions</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">A chronological log of all night audit runs</p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search date or auditor…"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-10 pr-4 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-indigo-400/50"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['Date', 'Auditor', 'Duration', 'Revenue', 'Status', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`px-5 py-3.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 ${i === 3 || i === 5 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
                        <p className="text-sm font-medium">Loading history…</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-slate-600">
                          <FileText className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">No audit records found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((audit) => (
                    <tr
                      key={audit.id}
                      className="group transition-colors hover:bg-white/[0.03]"
                    >
                      {/* Date */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">
                            {new Date(audit.businessDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="mt-0.5 text-[10px] text-slate-600">
                            {new Date(audit.businessDate).toLocaleDateString('en-GB', { weekday: 'short' })}
                          </span>
                        </div>
                      </td>

                      {/* Auditor */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                          >
                            {(audit.auditorName || 'SYS').substring(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-300">
                            {audit.auditorName || 'System'}
                          </span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm font-semibold tabular-nums text-slate-400">
                          {formatDuration(audit.startedAt, audit.completedAt)}
                        </span>
                      </td>

                      {/* Revenue */}
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-white tabular-nums">
                          {formatCurrency(audit.totalRevenue || 0)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={audit.status} />
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setSelectedAudit(audit)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-indigo-300 opacity-0 transition-all hover:border-indigo-400/40 hover:bg-indigo-400/10 group-hover:opacity-100"
                        >
                          View
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          {!loading && filteredHistory.length > 0 && (
            <div className="flex items-center justify-between border-t border-white/[0.05] px-6 py-3">
              <p className="text-[11px] text-slate-600">
                Showing <span className="font-bold text-slate-400">{filteredHistory.length}</span> of <span className="font-bold text-slate-400">{history.length}</span> records
              </p>
            </div>
          )}
        </div>

        {/* ── Audit Detail Dialog ─────────────────────────────────────────── */}
        <Dialog open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
          <DialogContent
            className="!max-h-[92vh] !w-[calc(100vw-2rem)] !max-w-4xl overflow-y-auto border-white/[0.08] p-0 shadow-2xl"
            style={{ background: '#07090f', borderRadius: '24px' }}
          >
            {selectedAudit && (
              <div className="flex flex-col">

                {/* Dialog Hero header */}
                <div
                  className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.16) 0%, rgba(124,58,237,0.10) 100%)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-violet-600/10 blur-2xl" />

                  <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/25 text-indigo-300"
                        style={{ background: 'rgba(99,102,241,0.12)', boxShadow: '0 0 28px rgba(99,102,241,0.25)' }}
                      >
                        <FileText className="h-7 w-7" />
                      </div>
                      <div>
                        <DialogTitle className="text-2xl font-bold tracking-tight text-white">Audit Summary</DialogTitle>
                        <DialogDescription className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(selectedAudit.businessDate).toLocaleDateString('en-GB', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </DialogDescription>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-2.5 sm:items-end">
                      <StatusBadge status={selectedAudit.status} />
                      {selectedAudit.closePackage && (
                        <button
                          onClick={() => downloadAuditPack(selectedAudit)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.06] px-4 py-2 text-xs font-bold text-slate-200 transition-all hover:bg-white/[0.10]"
                        >
                          <DownloadCloud className="h-4 w-4" />
                          Sealed Pack
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dialog body */}
                <div className="space-y-4 p-5 sm:p-7">

                  {/* Meta row */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Auditor', value: selectedAudit.auditorName || 'SYSTEM', icon: User },
                      { label: 'Duration', value: formatDuration(selectedAudit.startedAt, selectedAudit.completedAt), icon: Clock },
                      {
                        label: 'Rooms Billed',
                        value: String(selectedAudit.roomChargesPosted || 0),
                        icon: BedDouble,
                        action: (
                          <button
                            onClick={() => { setSelectedChargesAudit(selectedAudit); setSelectedAudit(null); }}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-indigo-300 transition-all hover:border-indigo-400/30 hover:bg-indigo-400/10"
                          >
                            <ListTree className="h-3 w-3" />
                            View Analysis
                          </button>
                        ),
                      },
                    ].map(({ label, value, icon: Icon, action }) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/[0.07] p-4"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </div>
                        <p className="mt-2 text-xl font-bold text-white">{value}</p>
                        {action}
                      </div>
                    ))}
                  </div>

                  {/* Financial Snapshot */}
                  <div
                    className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-5 sm:p-6"
                    style={{ background: 'rgba(255,255,255,0.025)' }}
                  >
                    <div className="pointer-events-none absolute right-4 top-4 opacity-[0.04]">
                      <Banknote className="h-24 w-24 text-white" />
                    </div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Financial Snapshot</h3>

                    {/* Total */}
                    <div className="mt-4 flex items-end justify-between border-b border-white/[0.07] pb-5">
                      <div>
                        <p className="text-3xl font-bold text-white tabular-nums">
                          {formatCurrency(Number(selectedAudit.totalRevenue) || 0)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">Total Daily Revenue</p>
                      </div>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                        <Banknote className="h-5 w-5" />
                      </span>
                    </div>

                    {/* Sub-breakdown */}
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {[
                        { label: 'Rooms', icon: BedDouble, iconCls: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-400', val: selectedAudit.financialSnapshot?.roomRevenue ?? selectedAudit.totalRoomRevenue ?? selectedAudit.totalRevenue ?? 0 },
                        { label: 'F&B', icon: Coffee, iconCls: 'border-amber-400/20 bg-amber-400/10 text-amber-400', val: selectedAudit.financialSnapshot?.fnbRevenue ?? 0 },
                        { label: 'Other', icon: Package, iconCls: 'border-sky-400/20 bg-sky-400/10 text-sky-400', val: selectedAudit.financialSnapshot?.otherRevenue ?? 0 },
                      ].map(({ label, icon: Icon, iconCls, val }) => (
                        <div key={label} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${iconCls}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</span>
                          </div>
                          <p className="mt-3 text-lg font-bold text-white tabular-nums">{formatCurrency(Number(val))}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Occupancy Snapshot */}
                  <div
                    className="rounded-2xl border border-white/[0.07] p-5 sm:p-6"
                    style={{ background: 'rgba(255,255,255,0.025)' }}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Occupancy Snapshot</h3>
                      <BedDouble className="h-4 w-4 text-indigo-400/60" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Occupancy', value: `${selectedAudit.occupancy || 0}%` },
                        { label: 'ADR', value: formatCurrency(selectedAudit.adr || 0) },
                        { label: 'RevPAR', value: formatCurrency(selectedAudit.revpar || 0) },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">{label}</p>
                          <p className="mt-1.5 text-2xl font-bold text-white tabular-nums">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Exceptions */}
                  {(selectedAudit.exceptions || (selectedAudit.financialSnapshot?.latePostingCount || 0) > 0) && (
                    <div className="rounded-2xl border border-amber-400/20 p-5 sm:p-6" style={{ background: 'rgba(245,158,11,0.06)' }}>
                      <div className="mb-4 flex items-center gap-2 text-amber-300">
                        <AlertTriangle className="h-4 w-4" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Exceptions & Late Postings</h3>
                      </div>
                      <div className="space-y-3">
                        {(selectedAudit.financialSnapshot?.latePostingCount || 0) > 0 && (
                          <div className="flex items-start gap-3 rounded-xl border border-amber-400/15 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <Clock className="mt-0.5 h-4 w-4 text-amber-400" />
                            <div>
                              <p className="text-sm font-semibold text-amber-200">{selectedAudit.financialSnapshot.latePostingCount} items posted late</p>
                              <p className="mt-0.5 text-xs text-amber-400/70">Folio items were posted to this business date after the audit was fully closed.</p>
                            </div>
                          </div>
                        )}
                        {Array.isArray(selectedAudit.exceptions) && selectedAudit.exceptions.map((ex: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-3 rounded-xl border border-amber-400/15 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
                            <div>
                              <p className="text-sm font-semibold text-amber-200">{ex.type || 'Exception'}</p>
                              <p className="mt-0.5 text-xs text-amber-400/70">{ex.message || JSON.stringify(ex)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Acknowledgements */}
                  {selectedAudit.acknowledgements && selectedAudit.acknowledgements.length > 0 && (
                    <div
                      className="rounded-2xl border border-white/[0.07] p-5 sm:p-6"
                      style={{ background: 'rgba(255,255,255,0.025)' }}
                    >
                      <div className="mb-5 flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-indigo-400" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Override Acknowledgements</h3>
                      </div>
                      <div className="relative ml-3 space-y-6 border-l border-white/[0.08] pb-2 pl-5">
                        {selectedAudit.acknowledgements.map((ack: any) => (
                          <div key={ack.id} className="relative">
                            <div className="absolute -left-[29px] top-1 h-3.5 w-3.5 rounded-full border-2 bg-indigo-500" style={{ borderColor: '#07090f' }} />
                            <p className="text-sm font-semibold text-white">
                              {ack.warningType.replace(/_/g, ' ')} overridden
                            </p>
                            <p className="mt-1.5 rounded-xl border border-white/[0.06] p-3 text-xs italic leading-relaxed text-slate-400" style={{ background: 'rgba(255,255,255,0.03)' }}>
                              "{ack.reason}"{ack.comment ? ` — ${ack.comment}` : ''}
                            </p>
                            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
                              <User className="h-3 w-3" /> Acknowledged by auditor
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer close */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setSelectedAudit(null)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl px-8 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 0 24px rgba(99,102,241,0.3)' }}
                    >
                      Close Summary
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Room Charges Dialog */}
        {selectedChargesAudit && (
          <RoomChargesDialog
            businessDate={selectedChargesAudit.businessDate}
            auditId={selectedChargesAudit.id}
            open
            showTrigger={false}
            onOpenChange={(open) => { if (!open) setSelectedChargesAudit(null); }}
          />
        )}
      </div>
    </div>
  );
}
