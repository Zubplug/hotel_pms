import React from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2, ChevronRight } from 'lucide-react';

interface FinancialReviewProps {
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

export function FinancialReview({ data, onResolve }: FinancialReviewProps) {
  const { pendingNightAuditPostings = [], unverifiedComplimentary, pendingDiscounts, pendingCheckInBypasses } = data.financial;
  const propertyId = data.property.id;
  const currency = data.property.baseCurrency || 'NGN';
  const estimatedRoomCharges = pendingNightAuditPostings.reduce(
    (acc: number, posting: any) => acc + Number(posting.netAmount ?? posting.amount ?? posting.grossAmount ?? 0),
    0,
  );

  const unverifiedCompl = unverifiedComplimentary?.filter((c: any) => c.status === 'PENDING_NIGHT_AUDIT') || [];

  const hasIssues = (pendingNightAuditPostings?.length || 0) > 0 || unverifiedCompl.length > 0 || (pendingDiscounts?.length || 0) > 0 || (pendingCheckInBypasses?.length || 0) > 0;

  if (!hasIssues) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 text-sm text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/20 text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="font-medium">All financial controls and room charges are verified.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Unposted Room Charges ───────────────────────────────────────── */}
      {pendingNightAuditPostings?.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-amber-300">Unposted Room Charges</h4>
              <p className="mt-0.5 text-xs text-amber-400/70">Rooms occupied tonight require nightly accommodation charges to be posted.</p>
            </div>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">
              {pendingNightAuditPostings.length} pending
            </span>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Estimated Total</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                  {formatMoney(estimatedRoomCharges, currency)}
                </p>
              </div>
              <button
                onClick={() => onResolve('ROOM_CHARGES_PREVIEW', { items: pendingNightAuditPostings, currency })}
                className="group flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-2.5 text-xs font-bold text-amber-300 transition-all hover:bg-amber-400/20"
              >
                Review Charges
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Complimentary Verifications ─────────────────────────────────── */}
      {unverifiedCompl.length > 0 && (
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-amber-300">Complimentary Verifications (Blocker)</h4>
            <p className="mt-0.5 text-xs text-amber-400/70">Comped items or rooms must be verified and explained before closing the day.</p>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4 flex items-center justify-between shadow-sm transition-colors hover:border-amber-400/25">
            <div>
              <p className="font-bold text-amber-200">{unverifiedCompl.length} Comped items pending review</p>
              <p className="mt-0.5 text-xs text-amber-300/80">
                Total value: <span className="font-semibold text-white">{formatMoney(unverifiedCompl.reduce((acc: number, c: any) => acc + Number(c.complAmount || 0), 0), currency)}</span>
              </p>
            </div>
            <button
              onClick={() => onResolve('COMPLIMENTARY_VERIFICATION', { propertyId, records: unverifiedCompl })}
              className="group flex shrink-0 items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-300 transition-all hover:bg-amber-400/20"
            >
              Verify all
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Check-In Bypass Reviews ─────────────────────────────────────── */}
      {pendingCheckInBypasses?.length > 0 && (
        <div className="pt-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-rose-300">Check-In Bypasses (Blocker)</h4>
              <p className="mt-0.5 text-xs text-rose-400/70">Guests checked in without the required deposit must be reviewed before closing the day.</p>
            </div>
            <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-bold text-rose-300">
              {pendingCheckInBypasses.length} pending
            </span>
          </div>
          <div className="space-y-2">
            {pendingCheckInBypasses.map((bypass: any) => (
              <div key={bypass.id} className="flex flex-col justify-between gap-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.03] p-4 text-sm transition-all hover:border-rose-400/25 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-rose-200">
                    {bypass.reservation?.primaryGuest?.firstName} {bypass.reservation?.primaryGuest?.lastName}
                  </p>
                  <p className="mt-0.5 text-xs text-rose-300/80">
                    Confirmation: <span className="font-medium text-rose-200">{bypass.reservation?.confirmationNumber || 'Unavailable'}</span>
                    {bypass.reason ? ` · ${bypass.reason}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onResolve('CHECKIN_BYPASS', { ...bypass, propertyId })}
                  className="w-full shrink-0 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-bold text-rose-300 transition-all hover:bg-rose-400/20 sm:w-auto"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pending Discounts ───────────────────────────────────────────── */}
      {pendingDiscounts?.length > 0 && (
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-amber-300">Pending Discounts</h4>
            <p className="mt-0.5 text-xs text-amber-400/70">Discounts awaiting management approval.</p>
          </div>
          <div className="space-y-2">
            {pendingDiscounts.map((disc: any) => (
              <div key={disc.id} className="flex flex-col justify-between gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-4 text-sm transition-all hover:border-amber-400/25 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-amber-200">
                    {formatMoney(disc.amount, currency)} <span className="text-amber-400/70">({disc.percentage}%)</span>
                  </p>
                  <p className="mt-0.5 text-xs text-amber-300/80">Reason: <span className="font-medium text-amber-200">{disc.reason}</span></p>
                </div>
                <button
                  onClick={() => onResolve('DISCOUNT_APPROVAL', disc)}
                  className="w-full shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-300 transition-all hover:bg-amber-400/20 sm:w-auto text-center"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
