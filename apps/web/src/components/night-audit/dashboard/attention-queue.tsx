'use client';
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronRight, XCircle, Info, Inbox,
  MonitorDot, Banknote, Users, Shield, Activity, Search, SlidersHorizontal,
  Clock3, ArrowUpRight, ListFilter,
} from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';
import { Panel, PanelHeader, Tabs, EmptyState, Badge, cx, TONE_HEX } from './ui';

type QueueItem = {
  id: string; label: string; description: string;
  type: 'blocker' | 'warning' | 'info'; category: 'system' | 'financial' | 'cash' | 'operations';
  actionType: string; payload: Record<string, unknown> | null;
};

const stableId = (prefix: string, item: Record<string, unknown>) => {
  const id = item.id ?? item.folioId ?? item.roomId ?? item.reservationId ?? item.drawerName ?? item.shiftReference ?? item.outlet;
  return `${prefix}-${id !== undefined ? String(id) : JSON.stringify(item).slice(0, 60)}`;
};

type Cat = 'all' | 'system' | 'financial' | 'cash' | 'operations';

const CAT_META: Record<Exclude<Cat, 'all'>, { icon: React.ElementType; color: string }> = {
  system:     { icon: MonitorDot, color: TONE_HEX.rose },
  financial:  { icon: Banknote,   color: TONE_HEX.amber },
  cash:       { icon: Shield,     color: TONE_HEX.amber },
  operations: { icon: Users,      color: TONE_HEX.sky },
};

const ACTION_LABELS: Record<string, string> = {
  POS_SESSION:                 'Close POS',
  FRONTDESK_SHIFT:             'Submit Shift',
  SYNC_CONFLICT:               'View Conflict',
  COMPLIMENTARY_VERIFICATION:  'Verify Comp',
  CHECKIN_BYPASS:              'Review Bypass',
  TRANSACTION_VERIFICATION:    'Verify Transaction',
  CASH_HANDOVER:               'Complete Handover',
  ARRIVALS:                    'Check In Guest',
  DEPARTURES:                  'Check Out Guest',
  ROOM_DISCREPANCY:            'Resolve Room',
  FOLIO_PREVIEW:               'View Folio',
  DISCOUNT_APPROVAL:           'Approve Discount',
};

export function AttentionQueue({
  data, onResolveItem,
}: {
  data: NightAuditData;
  onResolveItem?: (action: string, item: Record<string, unknown> | null) => void;
}) {
  const [cat, setCat] = useState<Cat>('all');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<'all' | 'blocker' | 'warning'>('all');

  const queue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];

    (data.system.openPosSessions || []).forEach((item: any) =>
      items.push({ id: stableId('pos', item), label: 'Open POS Session', description: String(item.outlet?.name ?? 'Register'), type: 'blocker', category: 'system', actionType: 'POS_SESSION', payload: item }));
    (data.system.openFrontdeskSessions || []).forEach((item: any) =>
      items.push({ id: stableId('fd', item), label: 'Open Cashier Shift', description: String(item.shiftReference ?? 'Front desk'), type: 'blocker', category: 'system', actionType: 'FRONTDESK_SHIFT', payload: item }));
    (data.system.financialSyncConflicts || []).forEach((item: any) =>
      items.push({ id: stableId('sync', item), label: 'Financial Sync Conflict', description: `Event: ${String(item.hotelEvent?.eventType ?? '')}`, type: 'blocker', category: 'system', actionType: 'SYNC_CONFLICT', payload: item }));
    (data.financial.unverifiedComplimentary || []).forEach((item: any) => {
      const g = item.reservationRoom?.reservation?.primaryGuest;
      const name = g ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() : 'Guest';
      items.push({ id: stableId('comp', item), label: 'Unverified Complimentary', description: `${name} · Room ${item.reservationRoom?.room?.number ?? '—'}`, type: 'blocker', category: 'financial', actionType: 'COMPLIMENTARY_VERIFICATION', payload: { propertyId: data.property.id, records: data.financial.unverifiedComplimentary } as any });
    });
    (data.financial.pendingCheckInBypasses || []).forEach((item: any) =>
      items.push({ id: stableId('bypass', item), label: 'Check-In Bypass', description: `Res: ${item.reservation?.confirmationNumber ?? ''}`, type: 'blocker', category: 'financial', actionType: 'CHECKIN_BYPASS', payload: { ...item, propertyId: data.property.id } as any }));
    (data.cash.unverifiedTransactions || []).forEach((item: any) =>
      items.push({ id: stableId('trans', item), label: 'Unverified Transaction', description: `${item.method === 'BANK_TRANSFER' ? 'Transfer' : 'POS'} — ${item.amount ?? ''}`, type: 'blocker', category: 'cash', actionType: 'TRANSACTION_VERIFICATION', payload: { unverifiedTransactions: [item], propertyId: data.property.id } as any }));
    (data.cash.cashHandovers || []).forEach((item: any) =>
      items.push({ id: stableId('handover', item), label: 'Pending Cash Handover', description: `${item.drawerName ?? 'Drawer'} · GM action`, type: 'warning', category: 'cash', actionType: 'CASH_HANDOVER', payload: { ...item, propertyId: data.property.id } as any }));
    (data.operational.arrivals || []).forEach((item: any) => {
      const g = item.primaryGuest;
      items.push({ id: stableId('arr', item), label: 'Pending Arrival', description: g ? `${g.firstName ?? 'Guest'} ${g.lastName ?? ''}`.trim() : 'Guest', type: 'blocker', category: 'operations', actionType: 'ARRIVALS', payload: item });
    });
    (data.operational.departures || []).forEach((item: any) => {
      const g = item.primaryGuest;
      items.push({ id: stableId('dep', item), label: 'Pending Departure', description: g ? `${g.firstName ?? 'Guest'} ${g.lastName ?? ''}`.trim() : 'Guest', type: 'blocker', category: 'operations', actionType: 'DEPARTURES', payload: item });
    });
    (data.operational.roomReconciliation?.filter((r: any) => r.issue) || []).forEach((item: any) =>
      items.push({ id: stableId('room', item), label: 'Room Discrepancy', description: `Room ${item.roomNumber ?? ''}`, type: 'warning', category: 'operations', actionType: 'ROOM_DISCREPANCY', payload: item }));
    (data.financial.highBalances || []).forEach((item: any) =>
      items.push({ id: stableId('hb', item), label: 'High Balance Alert', description: `Folio #${item.folioNumber ?? String(item.id ?? '').split('-')[0] ?? ''}`, type: 'warning', category: 'financial', actionType: 'FOLIO_PREVIEW', payload: item }));
    (data.financial.rateVariances || []).forEach((item: any) =>
      items.push({ id: stableId('rv', item), label: 'Rate Variance', description: `Res #${String(item.folio?.reservationId ?? '').slice(0, 8)}`, type: 'warning', category: 'financial', actionType: 'FOLIO_PREVIEW', payload: { id: item.folioId, folioNumber: item.folioNumber, balance: item.varianceAmount } as any }));
    (data.financial.pendingDiscounts || []).forEach((item: any) => {
      const g = item.reservationRoom?.reservation?.primaryGuest;
      const name = g ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() : 'Guest';
      items.push({ id: stableId('disc', item), label: 'Pending Discount', description: `${name} · Room ${item.reservationRoom?.room?.number ?? 'pending'}`, type: 'warning', category: 'financial', actionType: 'DISCOUNT_APPROVAL', payload: item });
    });

    return items;
  }, [data]);

  const catCounts: Record<Cat, number> = {
    all: queue.length,
    system: queue.filter((i) => i.category === 'system').length,
    financial: queue.filter((i) => i.category === 'financial').length,
    cash: queue.filter((i) => i.category === 'cash').length,
    operations: queue.filter((i) => i.category === 'operations').length,
  };

  const visible = queue.filter((item) => {
    const matchesCategory = cat === 'all' || item.category === cat;
    const matchesPriority = priority === 'all' || item.type === priority;
    const haystack = `${item.label} ${item.description} ${item.category}`.toLowerCase();
    return matchesCategory && matchesPriority && haystack.includes(query.trim().toLowerCase());
  });
  const blockerCount = queue.filter((i) => i.type === 'blocker').length;
  const warningCount = queue.filter((i) => i.type === 'warning').length;

  const filteredBlockers = visible.filter((i) => i.type === 'blocker');
  const filteredWarnings = visible.filter((i) => i.type !== 'blocker');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QueueMetric label="Requires action" value={blockerCount} detail="Blocks close" tone="rose" icon={XCircle} />
        <QueueMetric label="Review queue" value={warningCount} detail="Does not block close" tone="amber" icon={AlertTriangle} />
        <QueueMetric label="Open exceptions" value={queue.length} detail="Across all controls" tone="indigo" icon={ListFilter} />
        <QueueMetric label="Control mode" value="Live" detail="Refreshes every 5 seconds" tone="emerald" icon={Clock3} />
      </div>

      <Panel>
        <PanelHeader
          icon={Activity}
          title="Operations exception queue"
          subtitle={blockerCount > 0 ? 'Resolve blockers first, then review warnings.' : warningCount > 0 ? 'No blockers remain. Review the outstanding warnings.' : 'All controls are clear for close.'}
          tone={blockerCount > 0 ? 'rose' : warningCount > 0 ? 'amber' : 'emerald'}
          actions={<Badge tone={blockerCount > 0 ? 'rose' : 'emerald'} dot>{blockerCount > 0 ? 'Close is gated' : 'Ready to proceed'}</Badge>}
        />

        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guest, room, register, or exception…" className="h-9 w-full rounded-lg border border-white/[0.08] bg-black/20 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-400/40" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/20 p-1">
            <SlidersHorizontal className="ml-1.5 h-3.5 w-3.5 text-slate-600" />
            {(['all', 'blocker', 'warning'] as const).map((value) => (
              <button key={value} onClick={() => setPriority(value)} className={cx('rounded-md px-2.5 py-1.5 text-[10px] font-semibold capitalize transition', priority === value ? 'bg-white/[0.1] text-white' : 'text-slate-500 hover:text-slate-300')}>
                {value === 'all' ? 'All priorities' : `${value}s`}
              </button>
            ))}
          </div>
        </div>

        {queue.length > 0 && (
          <div className="overflow-x-auto border-b px-3 py-2.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <Tabs value={cat} onChange={setCat} items={[
              { key: 'all', label: 'All controls', count: catCounts.all },
              { key: 'system', label: 'System', count: catCounts.system, tone: catCounts.system > 0 ? 'rose' : 'neutral' },
              { key: 'financial', label: 'Financial', count: catCounts.financial, tone: catCounts.financial > 0 ? 'amber' : 'neutral' },
              { key: 'cash', label: 'Cash', count: catCounts.cash, tone: catCounts.cash > 0 ? 'amber' : 'neutral' },
              { key: 'operations', label: 'Operations', count: catCounts.operations, tone: catCounts.operations > 0 ? 'sky' : 'neutral' },
            ] as any} />
          </div>
        )}

        <div className="grid min-h-[280px] lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 border-b lg:border-b-0 lg:border-r" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {visible.length === 0 ? <EmptyState icon={Inbox} title={queue.length === 0 ? 'No exceptions detected' : 'No matching exceptions'} hint={queue.length === 0 ? "You're clear to proceed with the business-day close." : 'Try another search or filter.'} tone="emerald" /> : <div className="p-3">
              {filteredBlockers.length > 0 && <QueueSection title="Blockers" count={filteredBlockers.length} tone="rose" items={filteredBlockers} onResolveItem={onResolveItem} />}
              {filteredWarnings.length > 0 && <QueueSection title="Warnings" count={filteredWarnings.length} tone="amber" items={filteredWarnings} onResolveItem={onResolveItem} />}
            </div>}
          </div>
          <aside className="bg-white/[0.015] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300/70">Resolution protocol</p>
            <h3 className="mt-2 text-sm font-semibold text-white">Work from impact to detail</h3>
            <div className="mt-4 space-y-3 text-[11px] leading-relaxed text-slate-500">
              <ProtocolStep number="01" title="Clear blockers" detail="These items prevent a controlled close." tone="rose" />
              <ProtocolStep number="02" title="Review warnings" detail="Confirm the exception is understood or resolve it." tone="amber" />
              <ProtocolStep number="03" title="Recheck status" detail="The queue refreshes automatically as controls change." tone="emerald" />
            </div>
            <div className="mt-5 rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-200"><ArrowUpRight className="h-3.5 w-3.5" />Operator guidance</p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">Each action opens the existing resolution workflow. Changes remain auditable and are reflected here after refresh.</p>
            </div>
          </aside>
        </div>
      </Panel>
    </div>
  );
}

function QueueMetric({ label, value, detail, tone, icon: Icon }: { label: string; value: number | string; detail: string; tone: 'rose' | 'amber' | 'indigo' | 'emerald'; icon: React.ElementType }) {
  const color = TONE_HEX[tone];
  return <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5"><div className="flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p><Icon className="h-4 w-4" style={{ color }} /></div><p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">{value}</p><p className="mt-1 text-[10px] text-slate-600">{detail}</p><div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, ${color}70, transparent)` }} /></div>;
}

function QueueSection({ title, count, tone, items, onResolveItem }: { title: string; count: number; tone: 'rose' | 'amber'; items: QueueItem[]; onResolveItem?: (action: string, payload: Record<string, unknown> | null) => void }) {
  return <section className="mb-4 last:mb-0"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: TONE_HEX[tone] }}>{title}</p><Badge tone={tone}>{count}</Badge></div><ul className="space-y-2">{items.map((item) => <QueueItemCard key={item.id} item={item} onResolveItem={onResolveItem} />)}</ul></section>;
}

function ProtocolStep({ number, title, detail, tone }: { number: string; title: string; detail: string; tone: 'rose' | 'amber' | 'emerald' }) {
  return <div className="flex gap-2.5"><span className="font-mono text-[10px]" style={{ color: TONE_HEX[tone] }}>{number}</span><div><p className="font-semibold text-slate-300">{title}</p><p className="mt-0.5">{detail}</p></div></div>;
}

function QueueItemCard({
  item, onResolveItem,
}: {
  item: QueueItem;
  onResolveItem?: (action: string, payload: Record<string, unknown> | null) => void;
}) {
  const isBlocker = item.type === 'blocker';
  const SevIcon = isBlocker ? XCircle : item.type === 'info' ? Info : AlertTriangle;
  const sevColor = isBlocker ? TONE_HEX.rose : TONE_HEX.amber;
  const catMeta = item.category !== undefined ? CAT_META[item.category] : CAT_META.system;
  const CatIcon = catMeta.icon;
  const actionLabel = ACTION_LABELS[item.actionType] ?? 'Resolve';

  return (
    <li
      className="group relative flex items-start gap-3 overflow-hidden rounded-xl border p-3 transition-all hover:border-opacity-60"
      style={{
        borderColor: `${sevColor}20`,
        background: `${sevColor}06`,
        borderLeft: `3px solid ${sevColor}60`,
        boxShadow: `inset 3px 0 0 ${sevColor}20`,
      }}
    >
      {/* Severity icon */}
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: `${sevColor}15`,
          border: `1px solid ${sevColor}25`,
        }}
      >
        <SevIcon className="h-3.5 w-3.5" style={{ color: sevColor }} />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[12.5px] font-semibold text-white">{item.label}</p>
          <span
            className="rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wide"
            style={{
              borderColor: `${sevColor}30`,
              background: `${sevColor}10`,
              color: sevColor,
            }}
          >
            {item.type}
          </span>
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
          <CatIcon className="h-3 w-3 shrink-0" style={{ color: catMeta.color }} />
          {item.description}
        </p>
      </div>

      {/* Resolve button */}
      {onResolveItem && (
        <button
          onClick={() => onResolveItem(item.actionType, item.payload)}
          className={cx(
            'shrink-0 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all',
            'hover:scale-[1.03] active:scale-[0.98]',
          )}
          style={{
            borderColor: `${sevColor}30`,
            background: `${sevColor}10`,
            color: sevColor,
            boxShadow: `0 0 0 0 ${sevColor}00`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px -4px ${sevColor}60`;
            (e.currentTarget as HTMLButtonElement).style.background = `${sevColor}18`;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            (e.currentTarget as HTMLButtonElement).style.background = `${sevColor}10`;
          }}
        >
          {actionLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}
