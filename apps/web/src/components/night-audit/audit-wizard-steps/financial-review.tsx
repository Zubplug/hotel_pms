import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2 } from 'lucide-react';

interface FinancialReviewProps {
  data: NightAuditData;
  onResolve: (action: string, item: any) => void;
  baseCurrency: string;
}

const currency = (value: number, code = 'NGN') => 
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(value);

export function FinancialReview({ data, onResolve, baseCurrency }: FinancialReviewProps) {
  const { highBalances, rateVariances, pendingDiscounts, unverifiedComplimentary, pendingCheckInBypasses } = data.financial;
  
  const hasIssues = (highBalances?.length || 0) > 0 || 
                    (rateVariances?.length || 0) > 0 || 
                    (pendingDiscounts?.length || 0) > 0 || 
                    (unverifiedComplimentary?.length || 0) > 0 || 
                    (pendingCheckInBypasses?.length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-3 shadow-sm">
        <CheckCircle2 className="h-5 w-5" /> 
        <span>All financial controls are balanced.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {highBalances?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-500">High Balances</h4>
            <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Review folios exceeding their approved credit limit to secure additional payment or authorization.</p>
          </div>
          <div className="space-y-2">
            {highBalances.map((hb: any) => {
              const roomNumber = hb.reservation?.reservationRooms?.[0]?.room?.number || 'Unassigned';
              const guestName = hb.reservation?.primaryGuest ? `${hb.reservation.primaryGuest.firstName} ${hb.reservation.primaryGuest.lastName}` : 'Walk-in';
              const folioStr = hb.folioNumber || hb.reservation?.confirmationNumber || hb.id.split('-')[0].toUpperCase();
              const balance = Number(hb.balance);
              const limit = Number(hb.creditLimit);
              const over = balance - limit;

              return (
                <div key={hb.id} className="text-sm p-4 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-amber-300 dark:hover:border-amber-500/50">
                  <div className="space-y-1">
                    <p className="font-medium text-amber-950 dark:text-amber-400">
                      {guestName} &middot; Room {roomNumber} &middot; Folio #{folioStr}
                    </p>
                    <div className="flex gap-4 text-xs">
                      <p className="text-amber-800 dark:text-amber-500">
                        Balance: <span className="font-semibold text-amber-950 dark:text-amber-300">{currency(balance, baseCurrency)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Limit: <span>{currency(limit, baseCurrency)}</span>
                      </p>
                      <p className="text-rose-600 dark:text-rose-400 font-medium">
                        Over limit: {currency(over, baseCurrency)}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onResolve('FOLIO_PREVIEW', hb)} 
                    className="shrink-0 text-xs font-medium text-amber-800 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-300 bg-amber-100/50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-4 py-2 rounded-md transition-colors w-full sm:w-auto text-center"
                  >
                    Review Folio
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rateVariances?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-500">Rate Variances</h4>
            <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Room rates that deviate from their base reservation amount.</p>
          </div>
          <div className="space-y-2">
            {rateVariances.map((rv: any) => (
              <div key={rv.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-amber-300 dark:hover:border-amber-500/50">
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-400">Reservation #{rv.folio?.reservationId?.slice(0, 8) || 'Unknown'}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">Base: {currency(Number(rv.baseAmount), baseCurrency)} / Posted: <span className="font-semibold text-amber-900 dark:text-amber-300">{currency(Number(rv.unitAmount), baseCurrency)}</span></p>
                </div>
                <button 
                  onClick={() => onResolve('FOLIO_PREVIEW', { id: rv.folioId, folioNumber: rv.folioNumber, balance: rv.varianceAmount })} 
                  className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingDiscounts?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-indigo-700 dark:text-indigo-400">Pending Discount Approvals</h4>
            <p className="text-xs text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">Discounts that must be reviewed before room charges are posted.</p>
          </div>
          <div className="space-y-2">
            {pendingDiscounts.map((pd: any) => (
              <div key={pd.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/50">
                <div>
                  <p className="font-medium text-indigo-900 dark:text-indigo-300">{pd.details?.discountAmount ? currency(Number(pd.details.discountAmount), baseCurrency) : pd.details?.discountPercent ? `${pd.details.discountPercent}%` : 'Variable Discount'} ({pd.details?.targetType || 'RESERVATION_ROOM'})</p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-0.5">Requested by: {pd.requestedBy}</p>
                </div>
                <button 
                  onClick={() => onResolve('DISCOUNT_APPROVAL', pd)} 
                  className="shrink-0 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unverifiedComplimentary?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Complimentary Control (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">Every complimentary transaction must be verified before the business date can be closed.</p>
          </div>
          <div className="space-y-2">
            <div className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
              <div>
                <p className="font-medium text-rose-900 dark:text-rose-400">{unverifiedComplimentary.length} Unverified Complimentary Transactions</p>
                <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Pending review</p>
              </div>
              <button 
                onClick={() => window.location.href = '/night-audit/exceptions'}
                className="shrink-0 text-xs font-medium text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-md transition-colors w-full sm:w-auto text-center"
              >
                Go to Exceptions
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCheckInBypasses?.length > 0 && (
        <div>
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-rose-700 dark:text-rose-500">Check-In Deposit Bypasses (Blocker)</h4>
            <p className="text-xs text-rose-600/80 dark:text-rose-500/80 mt-0.5">All Check-In bypasses without payment must be resolved or verified before the business date can be closed.</p>
          </div>
          <div className="space-y-2">
            {pendingCheckInBypasses.map((bypass: any) => (
              <div key={bypass.id} className="text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-colors hover:border-rose-300 dark:hover:border-rose-500/50">
                <div>
                  <p className="font-medium text-rose-900 dark:text-rose-400">Bypass: {bypass.reservation?.confirmationNumber}</p>
                  <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">Guest: {bypass.reservation?.primaryGuest?.firstName} {bypass.reservation?.primaryGuest?.lastName}</p>
                </div>
                <button 
                  onClick={() => onResolve('CHECKIN_BYPASS', { ...bypass, propertyId: data.property.id })}
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
