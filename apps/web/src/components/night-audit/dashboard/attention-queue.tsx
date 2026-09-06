import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ChevronRight, XCircle, Info } from 'lucide-react';
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
  const directId =
    item.id ??
    item.folioId ??
    item.roomId ??
    item.reservationId ??
    item.drawerName ??
    item.shiftReference ??
    item.outlet;

  if (directId !== undefined && directId !== null) {
    return `${prefix}-${String(directId)}`;
  }

  return `${prefix}-${JSON.stringify(item).slice(0, 80)}`;
};

export function AttentionQueue({ data, onResolveItem }: { data: NightAuditData; onResolveItem?: (action: string, item: Record<string, unknown> | null) => void }) {
  const router = useRouter();

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
      items.push({ id: getStableQueueId('comp', item), label: 'Unverified Complimentary', description: 'Pending complimentary verification', type: 'blocker', actionType: 'GOTO_EXCEPTIONS', payload: null });
    });
    (data.financial.pendingCheckInBypasses || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('bypass', item), label: 'Check-In Bypass', description: `Reservation: ${String((item.reservation as Record<string, unknown> | undefined)?.confirmationNumber ?? '')}`, type: 'blocker', actionType: 'CHECKIN_BYPASS', payload: { ...item, propertyId: data.property.id } as Record<string, unknown> });
    });

    (data.cash.cashHandovers || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('handover', item), label: 'Pending Cash Handover', description: String((item.drawerName as string | undefined) ?? 'Drawer'), type: 'blocker', actionType: 'CASH_HANDOVER', payload: { ...item, propertyId: data.property.id } as Record<string, unknown> });
    });
    (data.cash.unverifiedTransactions || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('trans', item), label: 'Unverified Transaction', description: `${String((item.method as string | undefined) === 'BANK_TRANSFER' ? 'Transfer' : 'POS')} - ${String(item.amount ?? '')}`, type: 'blocker', actionType: 'TRANSACTION_VERIFICATION', payload: { unverifiedTransactions: [item], propertyId: data.property.id } as Record<string, unknown> });
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
      items.push({ id: getStableQueueId('rv', item), label: 'Rate Variance', description: `Res #${String((item.folio as Record<string, unknown> | undefined)?.reservationId?.slice(0, 8) ?? '')}`, type: 'warning', actionType: 'FOLIO_PREVIEW', payload: { id: item.folioId, folioNumber: item.folioNumber, balance: item.varianceAmount } as Record<string, unknown> });
    });
    (data.financial.pendingDiscounts || []).forEach((item: Record<string, unknown>) => {
      items.push({ id: getStableQueueId('disc', item), label: 'Pending Discount', description: `Requested by ${String(item.requestedBy ?? '')}`, type: 'warning', actionType: 'DISCOUNT_APPROVAL', payload: item });
    });

    return items;
  }, [data]);

  const sortedQueue = [...queue].sort((a, b) => {
    if (a.type === 'blocker' && b.type !== 'blocker') return -1;
    if (a.type !== 'blocker' && b.type === 'blocker') return 1;
    return 0;
  });

  return (
    <Card className="flex h-full flex-col border border-slate-200/70 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <CardHeader className="border-b border-slate-100 pb-3">
        <CardTitle className="flex items-center justify-between text-lg font-semibold text-slate-900">
          <span>Attention Queue</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">{sortedQueue.length} items</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-0">
        {sortedQueue.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sortedQueue.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 p-4 transition hover:bg-slate-50/80">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'blocker' ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                        <XCircle className="h-4 w-4" />
                      </div>
                    ) : item.type === 'warning' ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                        <Info className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${
                          item.type === 'blocker'
                            ? 'bg-rose-100 text-rose-700'
                            : item.type === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                  </div>
                </div>

                {onResolveItem && (
                  <button
                    onClick={() => {
                      if (item.actionType === 'GOTO_EXCEPTIONS') {
                        router.push('/night-audit/exceptions');
                      } else {
                        onResolveItem(item.actionType, item.payload);
                      }
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    Action
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Inbox zero</p>
            <p className="mt-1 max-w-[210px] text-xs text-slate-500">No pending exceptions or blockers require your attention.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

