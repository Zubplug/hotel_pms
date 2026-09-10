import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2, ClipboardList, AlertTriangle, Info } from 'lucide-react';

interface SystemControlReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
}

export function SystemControlReview({ data, onResolve }: SystemControlReviewProps) {
  const { openPosSessions, openFrontdeskSessions, financialSyncConflicts, openPosOrders } = data.system;
  const hasIssues =
    (openPosSessions?.length || 0) > 0 ||
    (openFrontdeskSessions?.length || 0) > 0 ||
    (financialSyncConflicts?.length || 0) > 0 ||
    (openPosOrders?.length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3 shadow-sm">
        <CheckCircle2 className="h-5 w-5" />
        <span>All systems and integrations are healthy.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Open POS Orders (Waiter Action Required) ───────────────────── */}
      {openPosOrders?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400">
              Open POS Orders — Waiter Action Required ({openPosOrders.length})
            </h4>
            <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">
              These orders have not been settled or voided. Notify the responsible waiter to resolve them on their POS terminal.
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-3 mb-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              The waiter must log back into their POS terminal, then settle or void each order before the business day can close.
            </p>
          </div>

          <div className="space-y-2">
            {openPosOrders.map((order: any) => (
              <div
                key={order.id}
                className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <ClipboardList className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      #{order.orderNumber}
                      {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {order.outletName} · {order.orderType?.replace('_', ' ')}
                    </p>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                      Waiter: {order.waiterName}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    ₦{Number(order.total || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    order.paymentStatus === 'UNPAID'
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Open POS Sessions ──────────────────────────────────────────── */}
      {openPosSessions?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Open POS Sessions (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">All Point of Sale sessions must be closed and reconciled before the business day can end.</p>
          </div>
          <div className="space-y-2">
            {openPosSessions.map((pos: any) => (
              <div key={pos.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">{pos.outlet?.name || 'Register'}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Opened by {pos.openedBy}</p>
                </div>
                <button
                  onClick={() => onResolve('POS_SESSION', pos)}
                  className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Open Front Desk Shifts ─────────────────────────────────────── */}
      {openFrontdeskSessions?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Open Front Desk Shifts (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">All Front Desk cashier shifts must be closed to prevent cross-day posting conflicts.</p>
          </div>
          <div className="space-y-2">
            {openFrontdeskSessions.map((fd: any) => (
              <div key={fd.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">Shift Reference: {fd.shiftReference}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Status: {fd.status}</p>
                </div>
                <button
                  onClick={() => onResolve('FRONTDESK_SHIFT', fd)}
                  className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Financial Sync Conflicts ───────────────────────────────────── */}
      {financialSyncConflicts?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Financial Sync Conflicts (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">Payments or charges failed to sync with the accounting system.</p>
          </div>
          <div className="space-y-2">
            {financialSyncConflicts.map((sc: any) => (
              <div key={sc.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">Type: {sc.aggregateType}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Event: {sc.hotelEvent?.eventType || 'Unknown'}</p>
                </div>
                <button
                  onClick={() => onResolve('SYNC_CONFLICT', sc)}
                  className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
