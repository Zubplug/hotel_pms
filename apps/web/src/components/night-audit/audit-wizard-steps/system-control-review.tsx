import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2, ClipboardList, AlertTriangle, Info } from 'lucide-react';

interface SystemControlReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
}

const GLASS = { background: 'rgba(255,255,255,0.025)' };

export function SystemControlReview({ data, onResolve }: SystemControlReviewProps) {
  const { openPosSessions, openFrontdeskSessions, financialSyncConflicts, openPosOrders } = data.system;
  const hasIssues =
    (openPosSessions?.length || 0) > 0 ||
    (openFrontdeskSessions?.length || 0) > 0 ||
    (financialSyncConflicts?.length || 0) > 0 ||
    (openPosOrders?.length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 text-sm text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/20 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="font-medium">All systems and integrations are healthy.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Open POS Orders (Waiter Action Required) ───────────────────── */}
      {openPosOrders?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="text-sm font-bold text-amber-300">
              Open POS Orders — Waiter Action Required ({openPosOrders.length})
            </h4>
            <p className="mt-0.5 text-xs text-amber-400/70">
              These orders have not been settled or voided. Notify the responsible waiter to resolve them on their POS terminal.
            </p>
          </div>

          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-400">
              <Info className="h-4 w-4" />
            </span>
            <p className="mt-1 text-[13px] text-amber-200">
              The waiter must log back into their POS terminal, then settle or void each order before the business day can close.
            </p>
          </div>

          <div className="space-y-2">
            {openPosOrders.map((order: any) => (
              <div
                key={order.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4 text-sm shadow-sm transition-colors hover:border-amber-400/25 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-200">
                      #{order.orderNumber}
                      {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {order.outletName} · <span className="capitalize">{order.orderType?.replace('_', ' ')}</span>
                    </p>
                    <p className="mt-1 text-xs font-semibold text-amber-400/90">
                      Waiter: {order.waiterName}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-base font-bold tabular-nums text-white">
                    ₦{Number(order.total || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                    order.paymentStatus === 'UNPAID'
                      ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                      : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
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
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-rose-300">Open POS Sessions (Blocker)</h4>
            <p className="mt-0.5 text-xs text-rose-400/70">All Point of Sale sessions must be closed and reconciled before the business day can end.</p>
          </div>
          <div className="space-y-2">
            {openPosSessions.map((pos: any) => (
              <div key={pos.id} className="flex flex-col justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-4 text-sm transition-all hover:bg-rose-400/[0.06] sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-rose-200">{pos.outlet?.name || 'Register'}</p>
                  <p className="mt-0.5 text-xs text-rose-300/80">Opened by <span className="font-semibold text-rose-200">{pos.openedBy}</span></p>
                </div>
                <button
                  onClick={() => onResolve('POS_SESSION', pos)}
                  className="w-full shrink-0 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-bold text-rose-300 transition-all hover:bg-rose-400/20 sm:w-auto text-center"
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
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-rose-300">Open Front Desk Shifts (Blocker)</h4>
            <p className="mt-0.5 text-xs text-rose-400/70">All Front Desk cashier shifts must be closed to prevent cross-day posting conflicts.</p>
          </div>
          <div className="space-y-2">
            {openFrontdeskSessions.map((fd: any) => (
              <div key={fd.id} className="flex flex-col justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-4 text-sm transition-all hover:bg-rose-400/[0.06] sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-rose-200">Shift Reference: {fd.shiftReference}</p>
                  <p className="mt-0.5 text-xs text-rose-300/80">Status: <span className="capitalize text-rose-200">{fd.status.toLowerCase()}</span></p>
                </div>
                <button
                  onClick={() => onResolve('FRONTDESK_SHIFT', fd)}
                  className="w-full shrink-0 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-bold text-rose-300 transition-all hover:bg-rose-400/20 sm:w-auto text-center"
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
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-rose-300">Financial Sync Conflicts (Blocker)</h4>
            <p className="mt-0.5 text-xs text-rose-400/70">Payments or charges failed to sync with the accounting system.</p>
          </div>
          <div className="space-y-2">
            {financialSyncConflicts.map((sc: any) => (
              <div key={sc.id} className="flex flex-col justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-4 text-sm transition-all hover:bg-rose-400/[0.06] sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-rose-200">Type: <span className="capitalize">{sc.aggregateType.toLowerCase()}</span></p>
                  <p className="mt-0.5 text-xs text-rose-300/80">Event: {sc.hotelEvent?.eventType || 'Unknown'}</p>
                </div>
                <button
                  onClick={() => onResolve('SYNC_CONFLICT', sc)}
                  className="w-full shrink-0 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-bold text-rose-300 transition-all hover:bg-rose-400/20 sm:w-auto text-center"
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
