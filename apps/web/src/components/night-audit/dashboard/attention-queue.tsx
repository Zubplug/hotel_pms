import React, { useMemo, useState } from 'react';
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

const TYPE_META = {
  blocker: {
    leftBorder: '#f43f5e',
    iconBg: 'border-rose-400/20 bg-rose-400/[0.08]',
    iconColor: 'text-rose-400',
    badge: 'border-rose-400/30 bg-rose-400/[0.08] text-rose-300',
    resolveBg: 'border-rose-400/30 bg-rose-400/[0.08] text-rose-300 hover:bg-rose-400/[0.15] hover:border-rose-400/50',
    icon: XCircle,
    pulse: true,
  },
  warning: {
    leftBorder: '#f59e0b',
    iconBg: 'border-amber-400/20 bg-amber-400/[0.08]',
    iconColor: 'text-amber-400',
    badge: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300',
    resolveBg: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300 hover:bg-amber-400/[0.15] hover:border-amber-400/50',
    icon: AlertTriangle,
    pulse: false,
  },
  info: {
    leftBorder: '#6366f1',
    iconBg: 'border-indigo-400/20 bg-indigo-400/[0.08]',
    iconColor: 'text-indigo-400',
    badge: 'border-indigo-400/30 bg-indigo-400/[0.08] text-indigo-300',
    resolveBg: 'border-indigo-400/30 bg-indigo-400/[0.08] text-indigo-300 hover:bg-indigo-400/[0.15] hover:border-indigo-400/50',
    icon: Info,
    pulse: false,
  },
};

function QueueSectionHeader({
  label,
  count,
  type,
  isOpen,
  onToggle,
}: {
  label: string;
  count: number;
  type: 'blocker' | 'warning';
  isOpen: boolean;
  onToggle: () => void;
}) {
  const colors = {
    blocker: {
      text: 'text-rose-300',
      badge: 'border-rose-400/30 bg-rose-400/[0.08] text-rose-300',
      dot: 'bg-rose-500',
    },
    warning: {
      text: 'text-amber-300',
      badge: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300',
      dot: 'bg-amber-500',
    },
  };
  const c = colors[type];

  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.02]"
    >
      <div className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 rounded-full ${c.dot} ${type === 'blocker' ? 'animate-pulse' : ''}`} />
        <span className={`text-[11px] font-bold uppercase tracking-[0.16em] ${c.text}`}>{label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${c.badge}`}>{count}</span>
      </div>
      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
    </button>
  );
}

export function AttentionQueue({
  data,
  onResolveItem,
}: {
  data: NightAuditData;
  onResolveItem?: (action: string, item: Record<string, unknown> | null) => void;
}) {
  const [blockersOpen, setBlockersOpen] = useState(true);
  const [warningsOpen, setWarningsOpen] = useState(true);

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
      items.push({ id: getStableQueueId('comp', item), label: 'Unverified Complimentary', description: `${guestName || 'Guest'} · Room ${String((room?.room as Record<string, unknown> | undefined)?.number ?? 'unavailable')}`, type: 'blocker', actionType: 'COMPLIMENTARY_VERIFICATION', payload: { propertyId: data.property.id, records: data.financial.unverifiedComplimentary } as Record<string, unknown> });
    });
    (data.financial.pendingCheckInBypasses || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('bypass', item), label: 'Check-In Bypass', description: `Reservation: ${String((item.reservation as Record<string, unknown> | undefined)?.confirmationNumber ?? '')}`, type: 'blocker', actionType: 'CHECKIN_BYPASS', payload: { ...item, propertyId: data.property.id } as Record<string, unknown> });
    });
    (data.cash.unverifiedTransactions || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('trans', item), label: 'Unverified Transaction', description: `${String((item.method as string | undefined) === 'BANK_TRANSFER' ? 'Transfer' : 'POS')} — ${String(item.amount ?? '')}`, type: 'blocker', actionType: 'TRANSACTION_VERIFICATION', payload: { unverifiedTransactions: [item], propertyId: data.property.id } as Record<string, unknown> });
    });
    (data.cash.cashHandovers || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('handover', item), label: 'Pending Cash Handover', description: `${String((item.drawerName as string | undefined) ?? 'Drawer')} · General Cashier action`, type: 'warning', actionType: 'CASH_HANDOVER', payload: { ...item, propertyId: data.property.id } as Record<string, unknown> });
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
      items.push({ id: getStableQueueId('hb', item), label: 'High Balance Alert', description: `Folio #${String(item.folioNumber ?? (String(item.id ?? '').split('-')[0] || '').toUpperCase())}`, type: 'warning', actionType: 'FOLIO_PREVIEW', payload: item });
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
      items.push({ id: getStableQueueId('disc', item), label: 'Pending Discount', description: `${guestName || 'Guest'} · Room ${roomNumber}`, type: 'warning', actionType: 'DISCOUNT_APPROVAL', payload: item });
    });

    return items;
  }, [data]);

  const blockers = queue.filter((i) => i.type === 'blocker');
  const warnings = queue.filter((i) => i.type === 'warning');

  const QueueItem = ({ item }: { item: QueueItem }) => {
    const meta = TYPE_META[item.type];
    const Icon = meta.icon;
    return (
      <div
        className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-all duration-150 hover:bg-white/[0.03]"
        style={{ borderLeft: `2px solid ${meta.leftBorder}40` }}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${meta.iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-white">{item.label}</p>
              <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${meta.badge}`}>
                {item.type}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.description}</p>
          </div>
        </div>

        {onResolveItem && (
          <button
            onClick={() => onResolveItem(item.actionType, item.payload)}
            className={cn(
              'group/btn inline-flex shrink-0 items-center gap-1 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all',
              meta.resolveBg,
              item.type === 'blocker' && 'animate-[pulse_3s_ease-in-out_infinite]',
            )}
          >
            Resolve
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex h-full flex-col rounded-[24px] border border-white/[0.06] overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-white">Attention Queue</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Items requiring resolution before close</p>
        </div>
        <div className="flex items-center gap-2">
          {blockers.length > 0 && (
            <span className="rounded-full border border-rose-400/30 bg-rose-400/[0.08] px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
              {blockers.length} blocker{blockers.length !== 1 ? 's' : ''}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          )}
          {queue.length === 0 && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
              All clear
            </span>
          )}
        </div>
      </div>

      {/* Queue */}
      <div className="flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] border border-emerald-400/20 bg-emerald-400/[0.07]">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-white">Inbox Zero</p>
            <p className="mt-2 max-w-[200px] text-xs leading-relaxed text-slate-500">
              No pending exceptions or blockers. You're clear to proceed.
            </p>
          </div>
        ) : (
          <>
            {/* Blockers section */}
            {blockers.length > 0 && (
              <div>
                <QueueSectionHeader
                  label="Blockers"
                  count={blockers.length}
                  type="blocker"
                  isOpen={blockersOpen}
                  onToggle={() => setBlockersOpen((v) => !v)}
                />
                {blockersOpen && (
                  <div className="divide-y divide-white/[0.04]">
                    {blockers.map((item) => <QueueItem key={item.id} item={item} />)}
                  </div>
                )}
              </div>
            )}

            {/* Warnings section */}
            {warnings.length > 0 && (
              <div className={blockers.length > 0 ? 'border-t border-white/[0.05]' : ''}>
                <QueueSectionHeader
                  label="Warnings"
                  count={warnings.length}
                  type="warning"
                  isOpen={warningsOpen}
                  onToggle={() => setWarningsOpen((v) => !v)}
                />
                {warningsOpen && (
                  <div className="divide-y divide-white/[0.04]">
                    {warnings.map((item) => <QueueItem key={item.id} item={item} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Simple cn helper (to avoid import issues if not used)
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
