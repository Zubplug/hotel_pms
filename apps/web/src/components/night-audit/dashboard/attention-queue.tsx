import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, XCircle, Info, Inbox } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

type QueueItem = {
  id: string;
  label: string;
  description: string;
  type: 'blocker' | 'warning' | 'info';
  actionType: string;
  payload: Record<string, unknown> | null;
};

const getStableQueueId = (prefix: string, item: Record<string, unknown>) => {
  const directId = item.id ?? item.folioId ?? item.roomId ?? item.reservationId ?? item.drawerName ?? item.shiftReference ?? item.outlet;
  if (directId !== undefined && directId !== null) return `${prefix}-${String(directId)}`;
  return `${prefix}-${JSON.stringify(item).slice(0, 80)}`;
};

const typeMeta = {
  blocker: {
    border: 'border-l-rose-500',
    dot: 'bg-rose-500',
    icon: <XCircle className="h-4 w-4 text-rose-400" />,
    badge: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    iconBg: 'border-rose-400/20 bg-rose-400/10',
  },
  warning: {
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    badge: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    iconBg: 'border-amber-400/20 bg-amber-400/10',
  },
  info: {
    border: 'border-l-indigo-500',
    dot: 'bg-indigo-500',
    icon: <Info className="h-4 w-4 text-indigo-400" />,
    badge: 'border-indigo-400/30 bg-indigo-400/10 text-indigo-300',
    iconBg: 'border-indigo-400/20 bg-indigo-400/10',
  },
};

export function AttentionQueue({ data, onResolveItem }: { data: NightAuditData; onResolveItem?: (action: string, item: Record<string, unknown> | null) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const queue = useMemo(() => {
    const items: QueueItem[] = [];

    (data.system.openPosSessions || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('pos', item), label: 'Open POS Session', description: String((item.outlet as Record<string, unknown> | undefined)?.name ?? 'Register'), type: 'blocker', actionType: 'POS_SESSION', payload: item });
    });
    (data.system.openFrontdeskSessions || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('fd', item), label: 'Open Cashier Shift', description: String((item.shiftReference as string | undefined) ?? 'Front desk'), type: 'blocker', actionType: 'FRONTDESK_SHIFT', payload: item });
    });
    (data.system.financialSyncConflicts || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('sync', item), label: 'Financial Sync Conflict', description: `Event: ${String((item.hotelEvent as Record<string, unknown> | undefined)?.eventType ?? '')}`, type: 'blocker', actionType: 'SYNC_CONFLICT', payload: item });
    });
    (data.financial.unverifiedComplimentary || []).forEach((item: Record<string, unknown>) => {
      const room = item.reservationRoom as Record<string, unknown> | undefined;
      const reservation = room?.reservation as Record<string, unknown> | undefined;
      const guest = reservation?.primaryGuest as Record<string, unknown> | undefined;
      const guestName = `${String(guest?.firstName ?? '')} ${String(guest?.lastName ?? '')}`.trim();
      items.push({ id: getStableQueueId('comp', item), label: 'Unverified Complimentary', description: `${guestName || 'Guest'} · Room ${String((room?.room as Record<string, unknown> | undefined)?.number ?? 'unavailable')} · ${String(item.requestedByName ?? 'Unknown')}`, type: 'blocker', actionType: 'COMPLIMENTARY_VERIFICATION', payload: { propertyId: data.property.id, records: data.financial.unverifiedComplimentary } as Record<string, unknown> });
    });
    (data.financial.pendingCheckInBypasses || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('bypass', item), label: 'Check-In Bypass', description: `Reservation: ${String((item.reservation as Record<string, unknown> | undefined)?.confirmationNumber ?? '')}`, type: 'blocker', actionType: 'CHECKIN_BYPASS', payload: { ...item, propertyId: data.property.id } as Record<string, unknown> });
    });
    (data.cash.cashHandovers || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('handover', item), label: 'Pending Cash Handover', description: `${String((item.drawerName as string | undefined) ?? 'Drawer')} · General Cashier action`, type: 'warning', actionType: 'CASH_HANDOVER', payload: { ...item, propertyId: data.property.id } as Record<string, unknown> });
    });
    (data.cash.unverifiedTransactions || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('trans', item), label: 'Unverified Transaction', description: `${String((item.method as string | undefined) === 'BANK_TRANSFER' ? 'Transfer' : 'POS')} — ${String(item.amount ?? '')}`, type: 'blocker', actionType: 'TRANSACTION_VERIFICATION', payload: { unverifiedTransactions: [item], propertyId: data.property.id } as Record<string, unknown> });
    });
    (data.operational.arrivals || []).forEach((item: Record<string, unknown>) => {
      const guest = item.primaryGuest as Record<string, unknown> | undefined;
      const guestName = `${String(guest?.firstName ?? 'Guest')} ${String(guest?.lastName ?? '')}`.trim() || 'Guest';
      items.push({ id: getStableQueueId('arr', item), label: 'Pending Arrival', description: guestName, type: 'warning', actionType: 'ARRIVALS', payload: item });
    });
    (data.operational.departures || []).forEach((item: Record<string, unknown>) => {
      const guest = item.primaryGuest as Record<string, unknown> | undefined;
      const guestName = `${String(guest?.firstName ?? 'Guest')} ${String(guest?.lastName ?? '')}`.trim() || 'Guest';
      items.push({ id: getStableQueueId('dep', item), label: 'Pending Departure', description: guestName, type: 'warning', actionType: 'DEPARTURES', payload: item });
    });
    (data.operational.roomReconciliation?.filter((r) => r.issue) || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('room', item), label: 'Room Discrepancy', description: `Room ${String(item.roomNumber ?? '')}`, type: 'warning', actionType: 'ROOM_DISCREPANCY', payload: item });
    });
    (data.financial.highBalances || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('hb', item), label: 'High Balance', description: `Folio #${String(item.folioNumber ?? (String(item.id ?? '').split('-')[0] || '').toUpperCase())}`, type: 'warning', actionType: 'FOLIO_PREVIEW', payload: item });
    });
    (data.financial.rateVariances || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('rv', item), label: 'Rate Variance', description: `Res #${String((item.folio as Record<string, unknown> | undefined)?.reservationId ?? '').slice(0, 8)}`, type: 'warning', actionType: 'FOLIO_PREVIEW', payload: { id: item.folioId, folioNumber: item.folioNumber, balance: item.varianceAmount } as Record<string, unknown> });
    });
    (data.financial.pendingDiscounts || []).forEach((item: Record<string, unknown>) => {
      const room = item.reservationRoom as Record<string, unknown> | undefined;
      const reservation = room?.reservation as Record<string, unknown> | undefined;
      const guest = reservation?.primaryGuest as Record<string, unknown> | undefined;
      const guestName = `${String(guest?.firstName ?? '')} ${String(guest?.lastName ?? '')}`.trim();
      const roomNumber = String((room?.room as Record<string, unknown> | undefined)?.number ?? 'pending');
      items.push({ id: getStableQueueId('disc', item), label: 'Pending Discount', description: `${guestName || 'Guest'} · Room ${roomNumber} · ${String(item.requestedByName ?? item.requestedBy ?? '')}`, type: 'warning', actionType: 'DISCOUNT_APPROVAL', payload: item });
    });

    return items;
  }, [data]);

  const sortedQueue = [...queue].sort((a, b) => {
    if (a.type === 'blocker' && b.type !== 'blocker') return -1;
    if (a.type !== 'blocker' && b.type === 'blocker') return 1;
    return 0;
  });

  const INITIAL_LIMIT = 7;
  const displayQueue = isExpanded ? sortedQueue : sortedQueue.slice(0, INITIAL_LIMIT);
  const hasMore = sortedQueue.length > INITIAL_LIMIT;

  const blockerCount = sortedQueue.filter((i) => i.type === 'blocker').length;
  const warningCount = sortedQueue.filter((i) => i.type === 'warning').length;

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-200/[0.06] bg-white/[0.03] backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] px-6 py-5">
        <div>
          <h3 className="text-base font-bold text-white">Attention Queue</h3>
          <p className="text-[11px] text-slate-500">Items requiring resolution before close</p>
        </div>
        <div className="flex items-center gap-2">
          {blockerCount > 0 && (
            <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-300">
              {blockerCount} blocker{blockerCount !== 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
              {warningCount}
            </span>
          )}
          {sortedQueue.length === 0 && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
              All clear
            </span>
          )}
        </div>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto">
        {sortedQueue.length > 0 ? (
          <div className="divide-y divide-white/[0.04]">
            {displayQueue.map((item) => {
              const meta = typeMeta[item.type];
              return (
                <div
                  key={item.id}
                  className={`group flex items-center justify-between gap-3 border-l-2 px-5 py-3.5 transition-all duration-150 hover:bg-white/[0.04] ${meta.border}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.iconBg}`}>
                      {meta.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{item.label}</p>
                        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${meta.badge}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.description}</p>
                    </div>
                  </div>

                  {/* Action */}
                  {onResolveItem ? (
                    <button
                      onClick={() => onResolveItem(item.actionType, item.payload)}
                      className="group/btn inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-indigo-300 transition-all hover:border-indigo-400/40 hover:bg-indigo-400/10"
                    >
                      Resolve
                      <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-sm font-bold text-white">Inbox zero</p>
            <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-slate-500">
              No pending exceptions or blockers require your attention.
            </p>
          </div>
        )}
      </div>

      {/* Expand/collapse footer */}
      {hasMore && (
        <div className="border-t border-white/[0.05] p-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
          >
            {isExpanded ? (
              <><ChevronUp className="h-4 w-4" /> Show less</>
            ) : (
              <><ChevronDown className="h-4 w-4" /> View all {sortedQueue.length} items</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
