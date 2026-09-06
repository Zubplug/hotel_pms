import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ChevronRight, XCircle, Info } from 'lucide-react';
import { NightAuditData } from '@/types/night-audit';

export function AttentionQueue({ data, onResolveItem }: { data: NightAuditData, onResolveItem?: (action: string, item: any) => void }) {
  const queue = useMemo(() => {
    const items: Array<{ id: string; label: string; description: string; type: 'blocker' | 'warning' | 'info'; actionType: string; payload: any }> = [];

    // System Blockers
    (data.system.openPosSessions || []).forEach((item: any) => {
      items.push({ id: `pos-${item.id}`, label: 'Open POS Session', description: item.outlet?.name || 'Register', type: 'blocker', actionType: 'POS_SESSION', payload: item });
    });
    (data.system.openFrontdeskSessions || []).forEach((item: any) => {
      items.push({ id: `fd-${item.id}`, label: 'Open Cashier Shift', description: item.shiftReference || 'Front desk', type: 'blocker', actionType: 'FRONTDESK_SHIFT', payload: item });
    });
    (data.system.financialSyncConflicts || []).forEach((item: any) => {
      items.push({ id: `sync-${item.id}`, label: 'Financial Sync Conflict', description: `Event: ${item.hotelEvent?.eventType}`, type: 'blocker', actionType: 'SYNC_CONFLICT', payload: item });
    });

    // Financial Blockers
    (data.financial.unverifiedComplimentary || []).forEach((item: any) => {
      items.push({ id: `comp-${item.id}`, label: 'Unverified Complimentary', description: 'Pending complimentary transaction verification', type: 'blocker', actionType: 'GOTO_EXCEPTIONS', payload: null });
    });
    (data.financial.pendingCheckInBypasses || []).forEach((item: any) => {
      items.push({ id: `bypass-${item.id}`, label: 'Check-In Bypass', description: `Reservation: ${item.reservation?.confirmationNumber}`, type: 'blocker', actionType: 'CHECKIN_BYPASS', payload: { ...item, propertyId: data.property.id } });
    });

    // Cash Blockers
    (data.cash.cashHandovers || []).forEach((item: any) => {
      items.push({ id: `handover-${item.id}`, label: 'Pending Cash Handover', description: item.drawerName || 'Drawer', type: 'blocker', actionType: 'CASH_HANDOVER', payload: { ...item, propertyId: data.property.id } });
    });
    (data.cash.unverifiedTransactions || []).forEach((item: any) => {
      items.push({ id: `trans-${item.id}`, label: 'Unverified Transaction', description: `${item.method === 'BANK_TRANSFER' ? 'Transfer' : 'POS'} - ${item.amount}`, type: 'blocker', actionType: 'TRANSACTION_VERIFICATION', payload: { unverifiedTransactions: [item], propertyId: data.property.id } });
    });

    // Warnings - Operational
    (data.operational.arrivals || []).forEach((item: any) => {
      items.push({ id: `arr-${item.id}`, label: 'Pending Arrival', description: `${item.primaryGuest?.firstName || 'Guest'} ${item.primaryGuest?.lastName || ''}`, type: 'warning', actionType: 'ARRIVALS', payload: item });
    });
    (data.operational.departures || []).forEach((item: any) => {
      items.push({ id: `dep-${item.id}`, label: 'Pending Departure', description: `${item.primaryGuest?.firstName || 'Guest'} ${item.primaryGuest?.lastName || ''}`, type: 'warning', actionType: 'DEPARTURES', payload: item });
    });
    (data.operational.roomReconciliation?.filter(r => r.issue) || []).forEach((item: any) => {
      items.push({ id: `room-${item.roomId}`, label: 'Room Discrepancy', description: `Room ${item.roomNumber}`, type: 'warning', actionType: 'ROOM_DISCREPANCY', payload: item });
    });

    // Warnings - Financial
    (data.financial.highBalances || []).forEach((item: any) => {
      items.push({ id: `hb-${item.id}`, label: 'High Balance', description: `Folio #${item.folioNumber || item.id.split('-')[0].toUpperCase()}`, type: 'warning', actionType: 'FOLIO_PREVIEW', payload: item });
    });
    (data.financial.rateVariances || []).forEach((item: any) => {
      items.push({ id: `rv-${item.id}`, label: 'Rate Variance', description: `Res #${item.folio?.reservationId?.slice(0, 8)}`, type: 'warning', actionType: 'FOLIO_PREVIEW', payload: { id: item.folioId, folioNumber: item.folioNumber, balance: item.varianceAmount } });
    });
    (data.financial.pendingDiscounts || []).forEach((item: any) => {
      items.push({ id: `disc-${item.id}`, label: 'Pending Discount', description: `Requested by ${item.requestedBy}`, type: 'warning', actionType: 'DISCOUNT_APPROVAL', payload: item });
    });

    return items;
  }, [data]);

  // Sort: Blockers first, then warnings
  const sortedQueue = [...queue].sort((a, b) => {
    if (a.type === 'blocker' && b.type !== 'blocker') return -1;
    if (a.type !== 'blocker' && b.type === 'blocker') return 1;
    return 0;
  });

  return (
    <Card className="h-full border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl flex flex-col">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span>Attention Queue</span>
          <span className="text-xs font-medium bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-500">
            {sortedQueue.length} Items
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px]">
        {sortedQueue.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sortedQueue.map((item) => (
              <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex items-start justify-between gap-4 group">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'blocker' ? (
                      <XCircle className="h-5 w-5 text-rose-500" />
                    ) : item.type === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Info className="h-5 w-5 text-indigo-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${item.type === 'blocker' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
                {onResolveItem && (
                  <button 
                    onClick={() => {
                      if (item.actionType === 'GOTO_EXCEPTIONS') {
                        window.location.href = '/night-audit/exceptions';
                      } else {
                        onResolveItem(item.actionType, item.payload);
                      }
                    }}
                    className="shrink-0 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm px-2.5 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400"
                  >
                    Action <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center px-4">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Inbox Zero</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px] mx-auto">
              No pending exceptions or blockers require your attention.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
