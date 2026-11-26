import React, { useState } from 'react';
import { NightAuditData } from '@/types/night-audit';
import { CheckCircle2, ChevronRight, FileText, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const { pendingNightAuditPostings = [], unverifiedComplimentary, pendingDiscounts, pendingCheckInBypasses, paymentCorrections = [], eventHall, guestAmenity } = data.financial;
  const [selectedEventInvoice, setSelectedEventInvoice] = useState<any | null>(null);
  const propertyId = data.property.id;
  const currency = data.property.baseCurrency || 'NGN';
  const unverifiedCompl = unverifiedComplimentary?.filter((c: any) => c.status === 'PENDING_NIGHT_AUDIT') || [];

  const hasIssues = (pendingNightAuditPostings?.length || 0) > 0 || unverifiedCompl.length > 0 || paymentCorrections.length > 0 || (pendingDiscounts?.length || 0) > 0 || (pendingCheckInBypasses?.length || 0) > 0 || (eventHall?.warnings || 0) > 0 || (eventHall?.blockers || 0) > 0 || (guestAmenity?.blockers?.length || 0) > 0 || (guestAmenity?.zeroCostItems?.length || 0) > 0;
  const eventInvoiceDialog = <EventInvoiceReviewDialog invoice={selectedEventInvoice} currency={currency} onClose={() => setSelectedEventInvoice(null)} />;

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

  if (!hasIssues) {
    return (
      <div className="space-y-4">
        {guestAmenityPanel}
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-5 text-sm text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.05)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/20 text-emerald-300"><CheckCircle2 className="h-4 w-4" /></span>
          <span className="font-medium">All financial controls, room charges, and amenity inventory are verified.</span>
        </div>
        {eventInvoiceDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {guestAmenityPanel}

      {paymentCorrections.length > 0 && (
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-rose-300">Payment Corrections — Blocker ({paymentCorrections.length})</h4>
            <p className="mt-0.5 text-xs text-rose-400/70">A payment method or amount correction is awaiting independent approval. Review it here before posting the audit.</p>
          </div>
          <div className="space-y-2">
            {paymentCorrections.map((correction: any) => {
              const guest = correction.originalPayment?.reservation?.primaryGuest;
              const guestName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() || 'Guest';
              const room = correction.originalPayment?.reservation?.reservationRooms?.[0]?.room?.number || '—';
              return <div key={correction.id} className="flex flex-col justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-4 text-sm sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="font-bold text-rose-200">{guestName} · Room {room}</p>
                  <p className="mt-1 text-xs text-slate-400">{correction.originalMethod} → {correction.correctedMethod} · {correction.originalPayment?.reference || 'Payment receipt'}</p>
                  <p className="mt-1 text-xs text-slate-500">{correction.reason}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right"><p className="text-xs text-slate-500">Amount</p><p className="font-bold text-white">{formatMoney(Number(correction.correctedAmount || 0), correction.currency || currency)}</p></div>
                  <button type="button" onClick={() => onResolve('PAYMENT_CORRECTION', correction)} className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-400/20">Review</button>
                </div>
              </div>;
            })}
          </div>
        </div>
      )}

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
            {(eventHall.reviewInvoices || []).length > 0 && <div className="mt-4 space-y-2 border-t border-white/[.08] pt-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Invoice review register</p>{eventHall.reviewInvoices.map((invoice: any) => <div key={invoice.id} className="flex flex-col justify-between gap-3 rounded-lg border border-white/[.08] bg-slate-950/20 p-3 sm:flex-row sm:items-center"><div className="min-w-0"><p className="font-semibold text-slate-200">{invoice.event?.name || invoice.event?.corporateAccount?.name || 'Event invoice'}</p><p className="mt-1 text-[11px] text-slate-500">{invoice.workflowStatus} · {invoice.status} · {formatMoney(Number(invoice.totalAmount || 0), invoice.currency || currency)}</p></div><button type="button" onClick={() => setSelectedEventInvoice(invoice)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-300/20"><FileText className="h-3.5 w-3.5" /> Review invoice</button></div>)}</div>}
          </div>
        </div>
      )}

      {/* ── Complimentary Verifications ─────────────────────────────────── */}
      {unverifiedCompl.length > 0 && (
        <div className="pt-2">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-amber-300">Complimentary Pending Approval (Blocker)</h4>
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
              <h4 className="text-sm font-bold text-rose-300">Check-In Bypass Pending Approval (Blocker)</h4>
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
            <h4 className="text-sm font-bold text-amber-300">Discount Pending Approval</h4>
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

      {eventInvoiceDialog}
    </div>
  );
}

function EventInvoiceReviewDialog({ invoice, currency, onClose }: { invoice: any | null; currency: string; onClose: () => void }) {
  if (!invoice) return null;
  const client = invoice.event?.corporateAccount?.name || `${invoice.event?.guest?.firstName || ''} ${invoice.event?.guest?.lastName || ''}`.trim() || invoice.event?.contactName || 'Individual client';
  const money = (value: unknown) => formatMoney(Number(value || 0), invoice.currency || currency);
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden border-white/10 bg-[#101a2d] p-0 text-slate-100 sm:max-w-4xl"><DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5 pr-14"><div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-xl font-semibold text-white">Event invoice review</DialogTitle><DialogDescription className="mt-2 text-slate-400">Read-only audit evidence. Approval and issuance remain in the controlled approval center.</DialogDescription></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white/[.06] hover:text-white" aria-label="Close invoice review"><X className="h-4 w-4" /></button></div></DialogHeader><div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6"><section className="grid gap-4 rounded-xl border border-white/10 bg-white/[.03] p-5 sm:grid-cols-2 lg:grid-cols-4"><InvoiceDetail label="Event" value={invoice.event?.name || 'Event invoice'} /><InvoiceDetail label="Client" value={client} /><InvoiceDetail label="Workflow" value={String(invoice.workflowStatus || 'DRAFT').replaceAll('_', ' ')} /><InvoiceDetail label="Invoice status" value={String(invoice.status || 'UNPAID').replaceAll('_', ' ')} /><InvoiceDetail label="Service date" value={invoice.event?.startDate ? new Date(invoice.event.startDate).toLocaleDateString('en-NG') : invoice.leaseBillingSchedule?.dueDate ? new Date(invoice.leaseBillingSchedule.dueDate).toLocaleDateString('en-NG') : '—'} /><InvoiceDetail label="Submitted" value={invoice.submittedAt ? new Date(invoice.submittedAt).toLocaleString('en-NG') : 'Not submitted'} /><InvoiceDetail label="Approved" value={invoice.approvedAt ? new Date(invoice.approvedAt).toLocaleString('en-NG') : 'Not approved'} /><InvoiceDetail label="Issued" value={invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString('en-NG') : 'Not issued'} /></section><section className="overflow-hidden rounded-xl border border-white/10"><div className="border-b border-white/10 bg-white/[.03] px-5 py-4"><h3 className="font-semibold text-white">Invoice items</h3><p className="mt-1 text-xs text-slate-400">Review the billable event and hall services before continuing the audit.</p></div><div className="divide-y divide-white/10">{(invoice.items || []).map((line: any) => <div key={line.id} className="flex flex-col justify-between gap-2 p-5 sm:flex-row"><div><p className="font-medium text-white">{line.description}</p><p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{line.category || 'OTHER'} · {line.quantity} × {money(line.unitPrice)}</p>{Number(line.discountAmount || 0) > 0 && <p className="mt-1 text-xs text-amber-300">Discount {money(line.discountAmount)} · Tax {money(line.taxAmount)}</p>}</div><p className="font-semibold text-white">{money(line.totalPrice)}</p></div>)}</div></section><section className="ml-auto max-w-md space-y-2 rounded-xl border border-white/10 bg-white/[.03] p-5 text-sm"><InvoiceTotal label="Subtotal" value={money(invoice.subTotal)} /><InvoiceTotal label="Discount" value={money(invoice.totalDiscount)} /><InvoiceTotal label="Tax" value={money(invoice.totalTax)} /><div className="my-3 border-t border-white/10" /><InvoiceTotal label="Invoice total" value={money(invoice.totalAmount)} strong /><InvoiceTotal label="Paid" value={money(invoice.paidAmount)} /><InvoiceTotal label="Balance" value={money(Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0))} /></section></div></DialogContent></Dialog>;
}

function InvoiceDetail({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-medium text-white" title={value}>{value}</p></div>; }
function InvoiceTotal({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className={`flex justify-between gap-4 ${strong ? 'text-base font-bold text-white' : 'text-slate-300'}`}><span>{label}</span><span>{value}</span></div>; }
