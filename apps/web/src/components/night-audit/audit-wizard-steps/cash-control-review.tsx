import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2, ChevronRight } from 'lucide-react';

interface CashControlReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
}

const formatMoney = (amount: number, currency: string = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
};

export function CashControlReview({ data, onResolve }: CashControlReviewProps) {
  const { unverifiedTransactions, pendingCashDrops = [] } = data.cash;
  const propertyId = data.property.id;
  const currency = data.property.baseCurrency || 'NGN';

  // Only consider transactions that actually need verification
  const pendingTransactions = unverifiedTransactions?.filter((t: any) => t.verificationStatus === 'UNVERIFIED') || [];
  
  const hasIssues = pendingTransactions.length > 0 || (pendingCashDrops?.length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 text-sm text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/20 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="font-medium">All cash controls and payments are verified.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Transaction Verifications ───────────────────────────────────── */}
      {pendingTransactions.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-emerald-300">Transaction Verification (Blocker)</h4>
              <p className="mt-0.5 text-xs text-emerald-400/70">Review and verify POS and Front Desk payments before close.</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] p-4 flex flex-col justify-between gap-4 shadow-sm transition-colors hover:border-emerald-400/25 sm:flex-row sm:items-center">
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {pendingTransactions.length} <span className="text-base font-normal text-slate-400">pending receipts</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Totaling <span className="font-bold text-slate-300">{formatMoney(pendingTransactions.reduce((acc: number, val: any) => acc + Number(val.amount || 0), 0), currency)}</span>
              </p>
            </div>
            <button
              onClick={() => onResolve('TRANSACTION_VERIFICATION', { propertyId, unverifiedTransactions: pendingTransactions })}
              className="group flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-2.5 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-400/20 sm:w-auto"
            >
              Verify Transactions
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Pending Cash Drops ─────────────────────────────────────────── */}
      {pendingCashDrops?.length > 0 && (
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-amber-300">Pending Cash Drops</h4>
            <p className="mt-0.5 text-xs text-amber-400/70">Unverified physical cash drops from POS/Front Desk shifts.</p>
          </div>
          <div className="space-y-2">
            {pendingCashDrops.map((drop: any) => (
              <div key={drop.id} className="flex flex-col justify-between gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4 text-sm transition-all hover:border-amber-400/25 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-white">
                    {formatMoney(drop.amount, currency)} <span className="text-slate-400">· {drop.location}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Dropped by <span className="font-medium text-slate-400">{drop.cashierName}</span></p>
                </div>
                <button
                  onClick={() => onResolve('CASH_DROP', drop)}
                  className="w-full shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-300 transition-all hover:bg-amber-400/20 sm:w-auto text-center"
                >
                  Confirm Drop
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
