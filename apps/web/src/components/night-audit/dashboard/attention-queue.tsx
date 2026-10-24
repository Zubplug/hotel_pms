'use client';
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, XCircle, Info, Inbox,
  MonitorDot, Banknote, Users, Shield, Activity,
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

const CAT_ICON: Record<Exclude<Cat, 'all'>, React.ElementType> = {
  system: MonitorDot, financial: Banknote, cash: Shield, operations: Users,
};

export function AttentionQueue({
  data, onResolveItem,
}: {
  data: NightAuditData;
  onResolveItem?: (action: string, item: Record<string, unknown> | null) => void;
}) {
  const [cat, setCat] = useState<Cat>('all');

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
      items.push({ id: stableId('handover', item), label: 'Pending Cash Handover', description: `${item.drawerName ?? 'Drawer'} · GC action`, type: 'warning', category: 'cash', actionType: 'CASH_HANDOVER', payload: { ...item, propertyId: data.property.id } as any }));
    (data.operational.arrivals || []).forEach((item: any) => {
      const g = item.primaryGuest;
      items.push({ id: stableId('arr', item), label: 'Pending Arrival', description: g ? `${g.firstName ?? 'Guest'} ${g.lastName ?? ''}`.trim() : 'Guest', type: 'warning', category: 'operations', actionType: 'ARRIVALS', payload: item });
    });
    (data.operational.departures || []).forEach((item: any) => {
      const g = item.primaryGuest;
      items.push({ id: stableId('dep', item), label: 'Pending Departure', description: g ? `${g.firstName ?? 'Guest'} ${g.lastName ?? ''}`.trim() : 'Guest', type: 'warning', category: 'operations', actionType: 'DEPARTURES', payload: item });
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

  const visible = cat === 'all' ? queue : queue.filter((i) => i.category === cat);
  const blockerCount = queue.filter((i) => i.type === 'blocker').length;
  const warningCount = queue.filter((i) => i.type === 'warning').length;

  return (
    <Panel>
      <PanelHeader
        icon={Activity}
        title="Attention Queue"
        subtitle="Items requiring resolution before close"
        tone="rose"
        actions={
          <>
            {blockerCount > 0 && <Badge tone="rose" dot>{blockerCount} blocker{blockerCount !== 1 ? 's' : ''}</Badge>}
            {warningCount > 0 && <Badge tone="amber" dot>{warningCount} warning{warningCount !== 1 ? 's' : ''}</Badge>}
            {queue.length === 0 && <Badge tone="emerald">All clear</Badge>}
          </>
        }
      />

      {/* Category tabs */}
      {queue.length > 0 && (
        <div className="border-b border-white/[0.05] px-4 py-2">
          <Tabs
            value={cat}
            onChange={setCat}
            items={[
              { key: 'all', label: 'All', count: catCounts.all },
              { key: 'system', label: 'System', count: catCounts.system, tone: catCounts.system > 0 ? 'rose' : 'neutral' },
              { key: 'financial', label: 'Financial', count: catCounts.financial, tone: catCounts.financial > 0 ? 'amber' : 'neutral' },
              { key: 'cash', label: 'Cash', count: catCounts.cash, tone: catCounts.cash > 0 ? 'amber' : 'neutral' },
              { key: 'operations', label: 'Operations', count: catCounts.operations, tone: catCounts.operations > 0 ? 'sky' : 'neutral' },
            ] as any}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <EmptyState icon={Inbox} title="Inbox zero" hint="No pending exceptions or blockers. You're clear to proceed." />
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {visible.map((item) => {
              const isBlocker = item.type === 'blocker';
              const Icon = isBlocker ? XCircle : item.type === 'info' ? Info : AlertTriangle;
              const iconColor = isBlocker ? TONE_HEX.rose : TONE_HEX.amber;
              const CatIcon = item.category !== undefined ? CAT_ICON[item.category] : MonitorDot;
              return (
                <li
                  key={item.id}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.025]"
                  style={{ borderLeft: `2px solid ${iconColor}30` }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: iconColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[12.5px] font-semibold text-white">{item.label}</p>
                      <span className="shrink-0 rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wide"
                        style={{ borderColor: `${iconColor}30`, background: `${iconColor}12`, color: iconColor }}>
                        {item.type}
                      </span>
                    </div>
                    <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                      <CatIcon className="h-3 w-3 shrink-0" />
                      {item.description}
                    </p>
                  </div>
                  {onResolveItem && (
                    <button
                      onClick={() => onResolveItem(item.actionType, item.payload)}
                      className={cx(
                        'group/btn inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                        isBlocker
                          ? 'border-rose-400/25 bg-rose-400/[0.06] text-rose-300 hover:bg-rose-400/[0.14]'
                          : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white',
                      )}
                    >
                      Resolve
                      <ChevronRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Panel>
  );
}
