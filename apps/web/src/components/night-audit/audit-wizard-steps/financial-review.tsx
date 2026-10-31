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
  const { pendingNightAuditPostings = [], unverifiedComplimentary, pendingDiscounts, pendingCheckInBypasses, eventHall, guestAmenity } = data.financial;
  const propertyId = data.property.id;
  const currency = data.property.baseCurrency || 'NGN';
  const estimatedRoomCharges = pendingNightAuditPostings.reduce(
    (acc: number, posting: any) => acc + Number(posting.netAmount ?? posting.amount ?? posting.grossAmount ?? 0),
    0,
  );

  const unverifiedCompl = unverifiedComplimentary?.filter((c: any) => c.status === 'PENDING_NIGHT_AUDIT') || [];
  const complimentaryFoodBeneficiaries = data.financial.complimentaryFoodBeneficiaries || [];

  const hasIssues = (pendingNightAuditPostings?.length || 0) > 0 || unverifiedCompl.length > 0 || (pendingDiscounts?.length || 0) > 0 || (pendingCheckInBypasses?.length || 0) > 0 || (eventHall?.warnings || 0) > 0 || (eventHall?.blockers || 0) > 0 || (guestAmenity?.blockers?.length || 0) > 0 || (guestAmenity?.zeroCostItems?.length || 0) > 0;

  const guestAmenityPanel = guestAmenity ? (
    <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h4 className={`text-sm font-bold ${guestAmenity.blockers.length ? 'text-rose-300' : 'text-emerald-300'}`}>Complimentary Guest Amenities & Inventory</h4>
          <p className="mt-0.5 text-xs text-slate-400">Free to the guest; issued from the selected housekeeping/laundry warehouse and posted to amenity COGS at inventory cost.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${guestAmenity.blockers.length ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}>
          {guestAmenity.enabled ? (guestAmenity.blockers.length ? `${guestAmenity.blockers.length} blocker(s)` : 'Ready') : 'Disabled'}
        </span>
      </div>
      {guestAmenity.enabled && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Warehouse</p><p className="mt-1 text-sm font-semibold text-white">{guestAmenity.warehouse?.name || 'Not configured'}</p></div>
            <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Guests / pack cost</p><p className="mt-1 text-sm font-semibold text-white">{guestAmenity.guestCount} · {formatMoney(guestAmenity.perGuestCost, currency)}</p></div>
            <div className="rounded-lg border border-white/[.06] bg-white/[.02] p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Estimated amenity COGS</p><p className="mt-1 text-sm font-semibold text-rose-200">{formatMoney(guestAmenity.estimatedCost, currency)}</p></div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/[.06]">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-white/[.03] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">Amenity</th><th className="px-3 py-2">Mapped stock</th><th className="px-3 py-2 text-right">Qty required</th><th className="px-3 py-2 text-right">On hand</th><th className="px-3 py-2 text-right">Cost</th><th className="px-3 py-2">Status</th></tr></thead>
              <tbody className="divide-y divide-white/[.05]">{guestAmenity.items.map((item) => <tr key={item.name}><td className="px-3 py-2 text-slate-200">{item.name}</td><td className="px-3 py-2 text-slate-400">{item.stockItemName || 'Not mapped'}</td><td className="px-3 py-2 text-right tabular-nums text-slate-300">{item.required} {item.unit || ''}</td><td className="px-3 py-2 text-right tabular-nums text-slate-300">{item.available}</td><td className="px-3 py-2 text-right tabular-nums text-rose-200">{formatMoney(item.estimatedCost, currency)}</td><td className="px-3 py-2"><span className={item.status === 'READY' ? 'text-emerald-300' : item.status === 'REFERENCE_COST' ? 'text-amber-300' : 'text-rose-300'}>{item.status === 'REFERENCE_COST' ? 'Reference cost' : item.status.replace('_', ' ')}</span></td></tr>)}</tbody>
            </table>
          </div>
          {guestAmenity.blockers.length > 0 && <div className="mt-3 space-y-1 text-xs text-rose-200">{guestAmenity.blockers.map((blocker) => <p key={blocker}>• {blocker}</p>)}</div>}
          {guestAmenity.zeroCostItems.length > 0 && <p className="mt-3 text-xs text-amber-300">Reference cost will be used for zero-cost inventory: {guestAmenity.zeroCostItems.join(', ')}.</p>}
        </>
      )}
    </div>
  ) : null;

  const complimentaryFoodPanel = (
    <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.03] p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h4 className="text-sm font-bold text-cyan-300">Complimentary Food Beneficiaries</h4>
          <p className="mt-0.5 text-xs text-cyan-200/60">Guests entitled to the complimentary food allocation for the current audit business date.</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
          {complimentaryFoodBeneficiaries.length} guest{complimentaryFoodBeneficiaries.length === 1 ? '' : 's'}
        </span>
      </div>
      {complimentaryFoodBeneficiaries.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-white/[.06]">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-white/[.03] text-[10px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-3 py-2">Guest</th><th className="px-3 py-2">Room</th><th className="px-3 py-2">Confirmation</th><th className="px-3 py-2">Source</th><th className="px-3 py-2 text-right">Food benefit</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[.05]">
              {complimentaryFoodBeneficiaries.map((guest: any) => (
                <tr key={guest.id}>
                  <td className="px-3 py-2 font-medium text-slate-200">{guest.guestName}</td>
                  <td className="px-3 py-2 text-slate-400">{guest.roomNumber}</td>
                  <td className="px-3 py-2 text-slate-400">{guest.confirmationNumber}</td>
                  <td className="px-3 py-2 text-slate-400">{guest.source === 'POS_BREAKFAST_REDEMPTION' ? `Offline/online POS · ${guest.coversRedeemed} cover(s)` : guest.status === 'POSTED' ? 'Posted room entitlement' : 'Room entitlement'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-cyan-200">{formatMoney(guest.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-white/[.06] bg-white/[.02] p-3 text-xs text-slate-500">No current-date complimentary food beneficiaries.</p>
      )}
    </div>
  );

  if (!hasIssues) {
    return (
      <div className="space-y-4">
        {complimentaryFoodPanel}
        {guestAmenityPanel}
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 text-sm text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/20 text-emerald-300"><CheckCircle2 className="h-4 w-4" /></span>
          <span className="font-medium">All financial controls, room charges, and amenity inventory are verified.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {complimentaryFoodPanel}
      {guestAmenityPanel}

      {eventHall && (eventHall.warnings > 0 || eventHall.blockers > 0) && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className={`text-sm font-bold ${eventHall.blockers > 0 ? 'text-rose-300' : 'text-cyan-300'}`}>Event & Hall Revenue Control</h4>
              <p className="mt-0.5 text-xs text-slate-400">Recurring leases and event invoices are reconciled against this business date. Approval is never bypassed.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${eventHall.blockers > 0 ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300'}`}>
              {eventHall.postedCount} posted
            </span>
          </div>
          <div className="space-y-2 rounded-xl border border-white/[.08] bg-white/[.02] p-4 text-xs">
            {eventHall.pendingBillingPeriods.length > 0 && <p className="text-amber-200">{eventHall.pendingBillingPeriods.length} recurring lease period(s) still need billing generation.</p>}
            {eventHall.awaitingApproval.length > 0 && <p className="text-amber-200">{eventHall.awaitingApproval.length} event/hall invoice(s) await Accountant approval.</p>}
            {eventHall.approvedAwaitingIssue.length > 0 && <p className="text-amber-200">{eventHall.approvedAwaitingIssue.length} approved event/hall invoice(s) await cashier issue.</p>}
            {eventHall.missingRevenuePosting.length > 0 && <p className="font-semibold text-rose-200">{eventHall.missingRevenuePosting.length} issued event/hall invoice(s) have no posted revenue entry.</p>}
          </div>
        </div>
      )}

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
