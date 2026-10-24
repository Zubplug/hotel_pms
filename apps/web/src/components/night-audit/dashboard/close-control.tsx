'use client';
import React from 'react';
import { AlertTriangle, BookOpenCheck, CheckCircle2, CircleDollarSign, FileWarning, LockKeyhole, Zap, ShieldCheck } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';
import { Panel, PanelHeader, Badge, cx, TONE_HEX, money } from './ui';

const STATUS_DEF: Record<string, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'indigo' | 'sky' }> = {
  READY: { label: 'Ready', tone: 'indigo' },
  BLOCKED: { label: 'Blocked', tone: 'rose' },
  CANNOT_CLOSE: { label: 'Cannot close', tone: 'rose' },
  HAS_VARIANCE: { label: 'Variance', tone: 'amber' },
  HAS_UNRESOLVED_EXCEPTIONS: { label: 'Exceptions', tone: 'amber' },
  IN_PROGRESS: { label: 'In progress', tone: 'sky' },
  COMPLETED: { label: 'Completed', tone: 'emerald' },
  COMPLETED_WITH_EXCEPTIONS: { label: 'Closed w/ exceptions', tone: 'amber' },
  FAILED: { label: 'Failed', tone: 'rose' },
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

  return (
    <div className="space-y-4">
      {/* Close control panel */}
      <Panel>
        <PanelHeader
          icon={LockKeyhole}
          title="Financial Close Control"
          subtitle="Controller view · current business-date close"
          tone="indigo"
          actions={<Badge tone={statusDef.tone}>{statusDef.label}</Badge>}
        />

        {/* Ledger summary */}
        {(journal_debit > 0 || journal_credit > 0) && (
          <div className="grid grid-cols-3 gap-px border-b border-white/[0.05] bg-white/[0.04]">
            {[
              { label: 'Debit', value: money(journal_debit, cur, true), color: TONE_HEX.indigo },
              { label: 'Credit', value: money(journal_credit, cur, true), color: TONE_HEX.emerald },
              { label: 'Difference', value: money(Math.abs(journal_diff), cur, true), color: Math.abs(journal_diff) < 1 ? TONE_HEX.emerald : TONE_HEX.rose },
            ].map((col) => (
              <div key={col.label} className="bg-[#0b111e] px-3 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{col.label}</p>
                <p className="mt-0.5 font-mono text-[13px] font-bold tabular-nums" style={{ color: col.color }}>{col.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Control rows */}
        <ul className="divide-y divide-white/[0.04]">
          {rows.map((r) => {
            const Icon = r.icon;
            const color = r.ok ? TONE_HEX.emerald : TONE_HEX.amber;
            const StatusIcon = r.ok ? CheckCircle2 : AlertTriangle;
            return (
              <li key={r.label} className="flex items-center gap-3 px-4 py-2.5">
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-400">{r.label}</p>
                  <p className="truncate text-[12.5px] font-bold text-white">{r.value}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px]">
                  <StatusIcon className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-slate-500">{r.sub}</span>
                </div>
              </li>
            );
          })}
        </ul>

        {/* GL coverage bar */}
        {expectedEntries > 0 && (
          <div className="border-t border-white/[0.05] px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-slate-600">GL journal coverage</span>
              <span className="font-mono text-[11px] font-semibold text-slate-300">{postedEntries} / {expectedEntries}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full bg-sky-400 transition-all duration-700"
                style={{ width: `${Math.min(100, (postedEntries / expectedEntries) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Balance proof line */}
        <div className={cx(
          'flex items-center gap-2 border-t border-white/[0.05] px-4 py-2.5 text-[11.5px]',
          close?.hasOpeningClosingBalance ? 'text-emerald-300' : 'text-amber-300',
        )}>
          {close?.hasOpeningClosingBalance
            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          <span>{close?.hasOpeningClosingBalance
            ? 'Opening, activity, and closing balances agree for all dated ledgers.'
            : 'Balance proof incomplete. Review before closing the business date.'}</span>
        </div>
      </Panel>

      {/* Smart Signals */}
      <Panel>
        <PanelHeader icon={Zap} title="Smart Signals" subtitle="Deterministic audit insights" tone="violet" />
        <div className="space-y-1 p-3">
          {insights.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2.5 text-[12px] font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              No abnormal signals detected
            </div>
          ) : insights.map((ins: any) => (
            <div
              key={`${ins.title}-${ins.metric}`}
              className={cx('flex items-start gap-2.5 rounded-lg border-l-[2px] bg-white/[0.02] px-3 py-2', ins.severity === 'HIGH' ? 'border-rose-400' : 'border-amber-400')}
            >
              {ins.severity === 'HIGH'
                ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                : <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
              <div>
                <p className="text-[12.5px] font-semibold text-white">{ins.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{ins.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
