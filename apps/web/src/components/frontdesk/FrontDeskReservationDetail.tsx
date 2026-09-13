'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FrontDeskCheckInDialog } from './FrontDeskCheckInDialog';
import { FrontDeskEditReservationDialog } from './FrontDeskEditReservationDialog';
import { FrontDeskReassignRoomDialog } from './FrontDeskReassignRoomDialog';
import { FrontDeskCancelReservationDialog } from './FrontDeskCancelReservationDialog';
import { NoShowActions } from '../reservations/NoShowActions';
import { FrontDeskAddPaymentDialog } from './FrontDeskAddPaymentDialog';
import { FrontDeskExtendStayDialog } from './FrontDeskExtendStayDialog';
import { FrontDeskQuickCheckoutDialog } from './FrontDeskQuickCheckoutDialog';
import { FrontDeskReceiptDialog } from './FrontDeskReceiptDialog';
import { FrontDeskDiscountModal } from './FrontDeskDiscountModal';
import { FrontDeskComplimentaryModal } from './FrontDeskComplimentaryModal';
import { FolioSection } from '../reservations/FolioSection';
import { FrontDeskCardInformationSection } from './FrontDeskCardInformationSection';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { toast } from 'sonner';
import { formatRoomNumber } from '@/lib/format-room';
import {
  LogIn, User, MapPin, CalendarClock, CreditCard, Receipt,
  LogOut, ChevronDown, Edit3, XCircle, Loader2, Percent,
  Gift, Building2, BedDouble,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const GLASS = { background: 'rgba(255,255,255,0.03)' };
const GLASS_BORDER = 'border border-white/[0.06]';

const STATUS_STYLE: Record<string, string> = {
  CHECKED_IN:  'border-sky-400/30 bg-sky-400/10 text-sky-300',
  CHECKED_OUT: 'border-slate-600/30 bg-slate-600/10 text-slate-400',
  CONFIRMED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  CANCELLED:   'border-rose-400/30 bg-rose-400/10 text-rose-300',
  NO_SHOW:     'border-amber-400/30 bg-amber-400/10 text-amber-300',
};

export function FrontDeskReservationDetail({ reservation }: { reservation: any }) {
  const queryClient = useQueryClient();
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isExtendStayOpen, setIsExtendStayOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isQuickCheckoutOpen, setIsQuickCheckoutOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isComplimentaryOpen, setIsComplimentaryOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const resRoom = reservation.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation.primaryGuest;
  const corporateAccount = reservation.corporateAccount;
  const folio = reservation.folio || reservation.folios?.[0];

  const balance = folio?.balance || 0;
  const isPaid = balance <= 0;
  const canCheckIn = reservation.status === 'CONFIRMED' && room;
  const canCheckOut = reservation.status === 'CHECKED_IN';
  const canAddPayment = ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status) && !!folio;
  const canExtendStay = reservation.status === 'CHECKED_IN';
  const canReassignRoom = ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status);
  const canEditReservation = reservation.status === 'CONFIRMED';
  const canCancelReservation = reservation.status === 'CONFIRMED';
  const canManageReservation = canEditReservation || canReassignRoom || canCancelReservation;
  const hasRoomAdjustment = Boolean(
    resRoom && (
      resRoom.discountType === 'COMPLIMENTARY' ||
      resRoom.discountType === 'FIXED_AMOUNT' ||
      resRoom.discountType === 'PERCENTAGE' ||
      Number(resRoom.discountAmount || 0) > 0 ||
      Number(resRoom.discountPercent || 0) > 0
    )
  );
  const canAddRoomAdjustment = Boolean(resRoom) && !hasRoomAdjustment;

  const latestPayment = folio?.payments
    ?.filter((p: any) => p.status === 'COMPLETED' || p.status === 'REFUNDED')
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const handlePrintReceipt = async () => {
    if (!latestPayment) return;
    if (HardwareBridge.isAvailable()) {
      setIsPrinting(true);
      try {
        const res = await HardwareBridge.printPaymentReceipt({
          receiptNumber: latestPayment.reference || latestPayment.id.substring(0, 8).toUpperCase(),
          guestName: guest ? `${guest.firstName} ${guest.lastName}` : 'Guest',
          roomNumber: formatRoomNumber(room?.number) || 'N/A',
          folioNumber: folio?.id?.substring(0, 8).toUpperCase() || '',
          amountPaid: Math.abs(Number(latestPayment.amount)),
          paymentMethod: latestPayment.method || 'CASH',
          paymentReference: latestPayment.reference || latestPayment.providerTransactionId,
          previousBalance: Number(folio?.balance || 0) + Math.abs(Number(latestPayment.amount)),
          remainingBalance: Number(folio?.balance || 0),
          cashierName: latestPayment.receivedByName || 'Front Desk',
          currency: folio?.currency || 'NGN',
          propertyName: reservation.property?.name || 'LodgeCore',
          propertyAddress: reservation.property?.address,
          printedAt: new Date().toISOString(),
        });
        if (res?.success) toast.success('Receipt printed successfully');
        else toast.error(`Printer error: ${res?.error || 'Unknown error'}`);
      } catch (e: any) {
        toast.error(`Printer error: ${e?.message || String(e)}`);
      } finally {
        setIsPrinting(false);
      }
    } else {
      setIsReceiptOpen(true);
    }
  };

  const formatCurrency = (amount: number, currency?: string | null) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN', maximumFractionDigits: 0 }).format(amount);

  /* Rate calculation */
  const hasCorporateRate = resRoom?.corporateRateAmount !== null && resRoom?.corporateRateAmount !== undefined;
  const baseRate = Number(hasCorporateRate ? resRoom?.corporateRateAmount : resRoom?.rateAmount || 0);
  const rateCurrency = resRoom?.corporateRateCurrency || resRoom?.currency || reservation.currency || 'NGN';
  const isPendingDiscount = typeof resRoom?.discountApprovalId === 'string' && resRoom.discountApprovalId.startsWith('PENDING:');
  let deductionAmount = 0;
  let deductionLabel = '';
  let isComplimentaryRate = false;

  if (isPendingDiscount && resRoom?.discountType === 'FIXED_AMOUNT') {
    deductionAmount = Number(resRoom?.discountAmount || 0); deductionLabel = 'Pending Fixed Discount';
  } else if (isPendingDiscount && resRoom?.discountType === 'PERCENTAGE') {
    const pct = Number(resRoom?.discountPercent || 0);
    deductionAmount = baseRate * (pct / 100); deductionLabel = `Pending ${pct}% Discount`;
  } else if (isPendingDiscount) {
    deductionLabel = 'Discount Pending Approval';
  } else if (resRoom?.discountType === 'COMPLIMENTARY') {
    isComplimentaryRate = true;
    const compAmount = Number(resRoom?.discountAmount || 0);
    deductionAmount = compAmount > 0 ? compAmount : baseRate;
    deductionLabel = compAmount > 0 ? 'Partial Comp' : 'Full Comp';
  } else if (resRoom?.discountType === 'FIXED_AMOUNT' || (!resRoom?.discountType && Number(resRoom?.discountAmount || 0) > 0)) {
    deductionAmount = Number(resRoom?.discountAmount || 0); deductionLabel = 'Fixed Discount';
  } else if (resRoom?.discountType === 'PERCENTAGE' || (!resRoom?.discountType && Number(resRoom?.discountPercent || 0) > 0)) {
    const pct = Number(resRoom?.discountPercent || 0);
    deductionAmount = baseRate * (pct / 100); deductionLabel = `${pct}% Discount`;
  }
  const finalRate = Math.max(0, baseRate - deductionAmount);
  const hasDeduction = deductionAmount > 0;

  const statusCls = STATUS_STYLE[reservation.status] ?? 'border-slate-600/30 bg-slate-600/10 text-slate-400';

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6" style={{ background: '#060b18', minHeight: '100%' }}>

      {/* ── Top banner ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">Reservation Detail</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-white">
            #{reservation.id.slice(0, 8).toUpperCase()}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Created on {format(new Date(reservation.createdAt), 'PPP')}</p>
        </div>
        <Badge variant="outline" className={`rounded-full border px-4 py-1.5 text-sm font-bold ${statusCls}`}>
          {reservation.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

        {/* ── LEFT PANE ── */}
        <div className="space-y-4 lg:col-span-4">

          {/* Guest profile */}
          <div className={`overflow-hidden rounded-[20px] ${GLASS_BORDER}`} style={GLASS}>
            <div className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
              >
                {guest?.firstName?.[0]}{guest?.lastName?.[0]}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{guest?.firstName} {guest?.lastName}</h3>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <User className="h-3 w-3" /> Guest
                </p>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Contact</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-300">{guest?.phone || 'No phone provided'}</p>
              <p className="mt-0.5 text-xs text-slate-500">{guest?.email || 'No email'}</p>
            </div>
          </div>

          {/* Corporate account */}
          {corporateAccount ? (
            <div className={`rounded-[20px] p-5 ${GLASS_BORDER} border-indigo-400/20`} style={{ background: 'rgba(99,102,241,0.07)' }}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-indigo-400/70">Corporate Reservation</p>
                  <p className="font-bold text-white">{corporateAccount.name}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {[['Account Code', corporateAccount.code || 'N/A'], ['Deposit Policy', corporateAccount.depositPolicy === 'WAIVED' ? 'Waived' : 'Required']].map(([lbl, val]) => (
                  <div key={String(lbl)}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-indigo-400/60">{String(lbl)}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-300">{String(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : reservation.corporateAccountId ? (
            <div className={`rounded-[20px] p-5 ${GLASS_BORDER} border-amber-400/20`} style={{ background: 'rgba(245,158,11,0.07)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-400/70">Corporate Link Missing Offline</p>
              <p className="mt-1.5 text-sm text-amber-300/80">Sync corporate accounts before checking in this reservation.</p>
            </div>
          ) : null}

          {/* Stay info card */}
          <div className={`rounded-[20px] ${GLASS_BORDER}`} style={GLASS}>
            <div className="space-y-5 px-5 py-5">
              {/* Room assignment */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Room Assignment</p>
                <div className="mt-2 flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-sky-400" />
                  <span className="text-xl font-bold text-white">Room {room?.number || 'Unassigned'}</span>
                  {room && <span className="text-sm text-slate-500">({room.roomType?.name})</span>}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                {[['Check-In', resRoom?.checkIn], ['Check-Out', resRoom?.checkOut]].map(([lbl, d]) => (
                  <div key={String(lbl)} className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{String(lbl)}</p>
                    <p className="mt-1.5 text-sm font-bold text-white">{d ? format(new Date(String(d)), 'MMM d, yyyy') : 'N/A'}</p>
                  </div>
                ))}
              </div>

              {/* Rate details */}
              <div className="border-t border-white/[0.05] pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Rate Details</p>
                  {canAddRoomAdjustment && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsDiscountOpen(true)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-[10px] font-bold text-slate-400 transition-colors hover:text-slate-200"
                      >
                        <Percent className="h-3 w-3" /> Discount
                      </button>
                      <button
                        onClick={() => setIsComplimentaryOpen(true)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-400/20"
                      >
                        <Gift className="h-3 w-3" /> Comp
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5 rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{hasCorporateRate ? 'Corporate Nightly Rate' : 'Base Nightly Rate'}</span>
                    <span className="font-bold text-slate-300">{formatCurrency(baseRate, rateCurrency)}</span>
                  </div>
                  {hasDeduction && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isComplimentaryRate ? 'text-emerald-300' : 'text-sky-300'}`}>{deductionLabel}</span>
                        {resRoom?.discountReason && (
                          <span className="max-w-[110px] truncate text-[10px] text-slate-600" title={resRoom.discountReason}>
                            ({resRoom.discountReason})
                          </span>
                        )}
                      </div>
                      <span className={`font-bold ${isComplimentaryRate ? 'text-emerald-300' : 'text-sky-300'}`}>
                        -{formatCurrency(deductionAmount)}
                      </span>
                    </div>
                  )}
                  {isPendingDiscount && (
                    <p className="text-[10px] font-semibold text-amber-400">
                      Pending night-audit approval — provisional rate shown
                    </p>
                  )}
                  <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                    <span className="text-sm font-bold text-white">Effective Rate</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black tabular-nums text-white">{formatCurrency(finalRate)}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-500">/ night</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2.5">
            <p className="ml-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Quick Actions</p>
            {canCheckIn && (
              <button
                onClick={() => setIsCheckInDialogOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
              >
                <LogIn className="h-5 w-5" /> Check In
              </button>
            )}
            {canCheckOut && (
              <button
                onClick={() => setIsQuickCheckoutOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
              >
                <LogOut className="h-5 w-5" /> Check Out
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              {canAddPayment && (
                <button
                  onClick={() => setIsAddPaymentOpen(true)}
                  className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] hover:text-white ${!canExtendStay ? 'col-span-2' : ''}`}
                >
                  <CreditCard className="h-4 w-4" /> Add Payment
                </button>
              )}
              {canExtendStay && (
                <button
                  onClick={() => setIsExtendStayOpen(true)}
                  className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] hover:text-white ${!canAddPayment ? 'col-span-2' : ''}`}
                >
                  <CalendarClock className="h-4 w-4" /> Extend Stay
                </button>
              )}
              {latestPayment && (
                <button
                  onClick={handlePrintReceipt}
                  disabled={isPrinting}
                  className={`${canAddPayment || canExtendStay ? 'col-span-2' : ''} flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] hover:text-white disabled:opacity-50`}
                >
                  {isPrinting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Printing…</>
                    : <><Receipt className="h-4 w-4" /> Print Receipt</>}
                </button>
              )}
              {canManageReservation && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="col-span-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] hover:text-white">
                    Manage Reservation <ChevronDown className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 rounded-xl border-white/[0.08] p-2 shadow-2xl"
                    style={{ background: '#0d1117' }}
                  >
                    {canEditReservation && (
                      <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white" onClick={() => setIsEditDialogOpen(true)}>
                        <Edit3 className="mr-2 h-4 w-4 text-slate-500" /> Edit Details
                      </DropdownMenuItem>
                    )}
                    {canAddRoomAdjustment && (
                      <>
                        <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white" onClick={() => setIsDiscountOpen(true)}>
                          <Percent className="mr-2 h-4 w-4 text-slate-500" /> Apply Discount
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white" onClick={() => setIsComplimentaryOpen(true)}>
                          <Gift className="mr-2 h-4 w-4 text-emerald-400" /> Set as Complimentary
                        </DropdownMenuItem>
                      </>
                    )}
                    {canReassignRoom && (
                      <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white" onClick={() => setIsReassignDialogOpen(true)}>
                        <MapPin className="mr-2 h-4 w-4 text-slate-500" /> Reassign Room
                      </DropdownMenuItem>
                    )}
                    {canCancelReservation && (
                      <>
                        <DropdownMenuSeparator className="my-2 border-white/[0.06]" />
                        <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-semibold text-rose-400 hover:bg-rose-400/10 hover:text-rose-300 focus:bg-rose-400/10 focus:text-rose-300" onClick={() => setIsCancelDialogOpen(true)}>
                          <XCircle className="mr-2 h-4 w-4" /> Cancel Reservation
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANE ── */}
        <div className="lg:col-span-8">
          <div className={`flex h-full flex-col overflow-hidden rounded-[20px] ${GLASS_BORDER}`} style={GLASS}>

            {/* Balance header */}
            <div className={`flex items-center justify-between border-b border-white/[0.06] p-6 ${
              isPaid
                ? 'bg-emerald-400/[0.07]'
                : 'bg-rose-400/[0.07]'
            }`}>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isPaid ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                  {isPaid ? 'Fully Settled' : 'Outstanding Balance'}
                </p>
                <p className={`mt-1 text-4xl font-black tracking-tight tabular-nums ${isPaid ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>

            {/* Folio section */}
            <div className="flex-1 space-y-6 p-6">
              {(reservation.status === 'CONFIRMED' || reservation.status === 'NO_SHOW') && (
                <NoShowActions
                  reservation={reservation}
                  onUpdated={() => queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })}
                />
              )}
              <FolioSection reservation={reservation} />
              <FrontDeskCardInformationSection reservation={reservation} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-dialogs ── */}
      {isCheckInDialogOpen && (
        <FrontDeskCheckInDialog reservationId={reservation.id} propertyId={reservation.propertyId} open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen} />
      )}
      {isEditDialogOpen && (
        <FrontDeskEditReservationDialog reservation={reservation} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />
      )}
      {isReassignDialogOpen && (
        <FrontDeskReassignRoomDialog reservation={reservation} open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen} />
      )}
      {isCancelDialogOpen && (
        <FrontDeskCancelReservationDialog reservation={reservation} open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen} />
      )}
      {isAddPaymentOpen && folio && (
        <FrontDeskAddPaymentDialog folio={folio} open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen} />
      )}
      {isExtendStayOpen && (
        <FrontDeskExtendStayDialog reservation={reservation} open={isExtendStayOpen} onOpenChange={setIsExtendStayOpen} />
      )}
      {isReceiptOpen && latestPayment && (
        <FrontDeskReceiptDialog
          paymentId={latestPayment.id}
          open={isReceiptOpen}
          onOpenChange={setIsReceiptOpen}
          localData={{
            receiptId: latestPayment.reference || `RCPT-${latestPayment.id.substring(0, 8).toUpperCase()}`,
            property: reservation.property || { name: 'LodgeCore' },
            guest: guest ? { name: `${guest.firstName} ${guest.lastName}`, email: guest.email } : null,
            reservation: {
              confirmationNumber: reservation.confirmationNumber,
              roomNumber: formatRoomNumber(room?.number) || 'Unassigned',
              checkIn: reservation.checkIn,
              checkOut: reservation.checkOut,
            },
            folio: {
              id: folio.id,
              totalCharges: Number(folio.totalCharges || 0),
              totalPayments: Number(folio.totalPayments || 0),
              balance: Number(folio.balance || 0),
            },
            payment: {
              ...latestPayment,
              date: latestPayment.createdAt,
              amount: Number(latestPayment.amount),
              providerTransactionId: latestPayment.providerTransactionId || latestPayment.reference,
            },
          }}
        />
      )}
      {isQuickCheckoutOpen && (
        <FrontDeskQuickCheckoutDialog open={isQuickCheckoutOpen} onOpenChange={setIsQuickCheckoutOpen} propertyId={reservation.propertyId} initialReservation={reservation} />
      )}
      {isDiscountOpen && resRoom && (
        <FrontDeskDiscountModal
          isOpen={isDiscountOpen}
          targetType="RESERVATION_ROOM"
          targetId={resRoom.id}
          targetTotal={Number(resRoom.rateAmount || 0)}
          onClose={() => setIsDiscountOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] }); setIsDiscountOpen(false); }}
        />
      )}
      {isComplimentaryOpen && resRoom && (
        <FrontDeskComplimentaryModal
          isOpen={isComplimentaryOpen}
          targetType="RESERVATION_ROOM"
          targetId={resRoom.id}
          targetTotal={Number(resRoom.rateAmount || 0)}
          onClose={() => setIsComplimentaryOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] }); setIsComplimentaryOpen(false); }}
        />
      )}
    </div>
  );
}
