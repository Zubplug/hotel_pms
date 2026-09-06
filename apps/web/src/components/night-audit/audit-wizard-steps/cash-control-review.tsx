import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2 } from 'lucide-react';

interface CashControlReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
  baseCurrency: string;
}

const currency = (value: number, code = 'NGN') => 
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

export function CashControlReview({ data, onResolve, baseCurrency }: CashControlReviewProps) {
  const { cashHandovers, bankDeposits, unverifiedTransactions } = data.cash;
  
  const hasIssues = (cashHandovers?.length || 0) > 0 || 
                    (bankDeposits?.length || 0) > 0 || 
                    (unverifiedTransactions?.length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3 shadow-sm">
        <CheckCircle2 className="h-5 w-5" /> 
        <span>All cash handling, deposits, and transactions are verified.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cashHandovers?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Pending Cash Handovers (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">Cash drawers must be physically handed over and reconciled in the system before closing.</p>
          </div>
          <div className="space-y-2">
            {cashHandovers.map((ch: any) => (
              <div key={ch.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">{ch.drawerName || 'Pending Handover'}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Pending Handover</p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  <span className="font-semibold text-rose-700 dark:text-rose-400">{currency(Number(ch.amount), baseCurrency)}</span>
                  <button 
                    onClick={() => onResolve('CASH_HANDOVER', { ...ch, propertyId: data.property.id })}
                    className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Action
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bankDeposits?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-500">Pending Bank Deposits</h4>
            <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Review cash drops that have not yet been batched for bank deposit.</p>
          </div>
          <div className="space-y-2">
            {bankDeposits.map((bd: any) => (
              <div key={bd.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-amber-300 dark:hover:border-amber-500/50">
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-400">Reference: {bd.depositReference}</p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">{currency(Number(bd.declaredAmount || bd.expectedAmount), baseCurrency)}</span>
                  <a 
                    href="/finance/deposits" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-md transition-colors text-center block"
                  >
                    Review
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unverifiedTransactions?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Pending Transaction Verifications (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">The Night Auditor must verify all POS and Bank Transfer receipts submitted to the cashier per shift.</p>
          </div>
          <div className="space-y-2">
            <div className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
              <div>
                <p className="font-medium text-rose-900 dark:text-rose-400">{unverifiedTransactions.length} Unverified Transactions</p>
                <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Pending verification</p>
              </div>
              <button 
                onClick={() => onResolve('TRANSACTION_VERIFICATION', { unverifiedTransactions, propertyId: data.property.id })}
                className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
              >
                Verify Transactions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
