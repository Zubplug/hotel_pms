'use client';
import React from 'react';
import { AlertTriangle, BookOpenCheck, CheckCircle2, CircleDollarSign, FileWarning, LockKeyhole, Zap, ShieldCheck } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';
import { Panel, PanelHeader, Badge, cx, TONE_HEX, money } from './ui';

const STATUS_DEF: Record<string, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky' }> = {
  READY:                       { label: 'Ready',                tone: 'indigo' },
  BLOCKED:                     { label: 'Blocked',              tone: 'rose' },
  CANNOT_CLOSE:                { label: 'Cannot close',         tone: 'rose' },
  HAS_VARIANCE:                { label: 'Variance',             tone: 'amber' },
  HAS_UNRESOLVED_EXCEPTIONS:   { label: 'Exceptions',           tone: 'amber' },
  IN_PROGRESS:                 { label: 'In progress',          tone: 'sky' },
  COMPLETED:                   { label: 'Completed',            tone: 'emerald' },
  COMPLETED_WITH_EXCEPTIONS:   { label: 'Closed w/ exceptions', tone: 'amber' },
  FAILED:                      { label: 'Failed',               tone: 'rose' },
};

interface Row { label: string; value: string; sub: string; ok: boolean; icon: React.ElementType }

export function CloseControl({ data }: { data: NightAuditData }) {
  const close = data.closeControl;
  const journal = data.accounting?.journal;
  const insights = data.insights || [];
  const cur = data.property.baseCurrency;
  const statusDef = STATUS_DEF[close?.status || 'READY'] || STATUS_DEF.READY;

  const rows: Row[] = [
    {
      label: 'GL Control', icon: BookOpenCheck,
      value: journal?.status || 'NOT RUN',
      sub: `${journal?.postedEntryCount ?? 0} entries posted`,
      ok: journal?.status === 'BALANCED',
    },
    {
      label: 'Open Exceptions', icon: FileWarning,
      value: String(data.accounting?.transactionExceptions ?? 0),
      sub: 'Payment exceptions',
      ok: !data.accounting?.transactionExceptions,
    },
    {
      label: 'Acctg Period', icon: BookOpenCheck,
      value: data.accounting?.period?.status || 'NOT SET',
      sub: data.accounting?.period?.name || 'No active period',
      ok: data.accounting?.period?.status === 'OPEN',
    },
    {
      label: 'Balance Proof', icon: CircleDollarSign,
      value: close?.hasOpeningClosingBalance ? 'Available' : 'Pending',
      sub: close?.hasOpeningClosingBalance ? 'Ledger reconciled' : 'Enhancement required',
      ok: !!close?.hasOpeningClosingBalance,
    },
  ];

  const journal_debit = Number(journal?.debit ?? 0);
  const journal_credit = Number(journal?.credit ?? 0);
  const journal_diff = Number(journal?.difference ?? 0);
  const postedEntries = journal?.postedEntryCount || 0;
  const expectedEntries = Math.max(postedEntries, Number((journal as any)?.expectedEntryCount || 0));
  const isBalanced = Math.abs(journal_diff) < 1;

  return (
    <div className="space-y-3">
      {/* ── Close control panel ──────────────────────────────────────────── */}
      <Panel>
        <PanelHeader
          icon={LockKeyhole}
          title="Financial Close Control"
          subtitle="Controller view · current business-date close"
          tone="indigo"
          actions={<Badge tone={statusDef.tone}>{statusDef.label}</Badge>}
        />

        {/* GL Ledger Summary — 3 glass tiles */}
        {(journal_debit > 0 || journal_credit > 0) && (
          <div
            className="grid grid-cols-3 gap-px border-b"
            style={{
              borderColor: 'rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {[
              { label: 'Debit',      value: money(journal_debit, cur, true),          color: TONE_HEX.indigo },
              { label: 'Credit',     value: money(journal_credit, cur, true),         color: TONE_HEX.emerald },
              {
                label: 'Difference',
                value: money(Math.abs(journal_diff), cur, true),
                color: isBalanced ? TONE_HEX.emerald : TONE_HEX.rose,
              },
            ].map((col) => (
              <div
                key={col.label}
                className="relative flex flex-col items-center justify-center py-3 text-center"
                style={{ background: 'rgba(7,15,30,0.9)' }}
              >
                {/* Ambient glow */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse 70% 70% at 50% 80%, ${col.color}12, transparent)`,
                  }}
                />
                <p className="relative text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  {col.label}
                </p>
                <p
                  className="relative mt-1 font-mono text-[16px] font-bold tabular-nums"
                  style={{
                    color: col.color,
                    textShadow: `0 0 20px ${col.color}60`,
                  }}
                >
                  {col.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Control checklist */}
        <ul className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {rows.map((r) => {
            const Icon = r.icon;
            const color = r.ok ? TONE_HEX.emerald : TONE_HEX.amber;
            const StatusIcon = r.ok ? CheckCircle2 : AlertTriangle;
            return (
              <li
                key={r.label}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.015]"
                style={{ borderLeft: `3px solid ${color}30` }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                  style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
                >
                  <Icon className="h-3.5 w-3.5 text-slate-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-400">{r.label}</p>
                  <p className="truncate text-[13px] font-bold text-white">{r.value}</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <StatusIcon
                    className="h-3.5 w-3.5"
                    style={{
                      color,
                      filter: r.ok ? `drop-shadow(0 0 4px ${color}70)` : undefined,
                    }}
                  />
                  <span className="text-slate-500">{r.sub}</span>
                </div>
              </li>
            );
          })}
        </ul>

        {/* GL coverage bar */}
        {expectedEntries > 0 && (
          <div className="border-t px-4 py-2.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] font-semibold text-slate-600">GL journal coverage</span>
              <span className="font-mono text-[11px] font-semibold text-slate-300">
                {postedEntries} / {expectedEntries}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, (postedEntries / expectedEntries) * 100)}%`,
                  background: TONE_HEX.cyan,
                  boxShadow: `0 0 8px ${TONE_HEX.cyan}50`,
                }}
              />
            </div>
          </div>
        )}

        {/* Balance proof strip */}
        <div
          className={cx(
            'flex items-center gap-2 border-t px-4 py-2.5 text-[11.5px] font-semibold',
          )}
          style={{
            borderColor: 'rgba(255,255,255,0.05)',
            color: close?.hasOpeningClosingBalance ? TONE_HEX.emerald : TONE_HEX.amber,
            background: close?.hasOpeningClosingBalance
              ? 'rgba(16,185,129,0.06)'
              : 'rgba(245,158,11,0.06)',
          }}
        >
          {close?.hasOpeningClosingBalance
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ filter: `drop-shadow(0 0 4px ${TONE_HEX.emerald}70)` }} />
            : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          <span>
            {close?.hasOpeningClosingBalance
              ? 'Opening, activity, and closing balances agree for all dated ledgers.'
              : 'Balance proof incomplete. Review before closing the business date.'}
          </span>
        </div>
      </Panel>

      {/* ── Audit Intelligence (Smart Signals) ───────────────────────────── */}
      <Panel>
        <PanelHeader
          icon={Zap}
          title="Audit Intelligence"
          subtitle="Smart signals · deterministic insights"
          tone="violet"
        />
        <div className="space-y-1.5 p-3">
          {insights.length === 0 ? (
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-3 text-[12px] font-medium text-emerald-300"
              style={{
                borderColor: 'rgba(52,211,153,0.2)',
                background: 'rgba(52,211,153,0.06)',
              }}
            >
              <ShieldCheck
                className="h-4 w-4 shrink-0"
                style={{ filter: `drop-shadow(0 0 6px ${TONE_HEX.emerald}80)` }}
              />
              No abnormal signals detected — all systems nominal.
            </div>
          ) : (
            insights.map((ins: any) => {
              const isHigh = ins.severity === 'HIGH';
              const color = isHigh ? TONE_HEX.rose : TONE_HEX.amber;
              return (
                <div
                  key={`${ins.title}-${ins.metric}`}
                  className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                  style={{
                    borderLeft: `3px solid ${color}`,
                    background: `${color}07`,
                    border: `1px solid ${color}18`,
                    borderLeftColor: color,
                    borderLeftWidth: '3px',
                  }}
                >
                  {isHigh
                    ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    : <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
                  <div>
                    <p className="text-[12.5px] font-semibold text-white">{ins.title}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{ins.detail}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </div>
  );
}
