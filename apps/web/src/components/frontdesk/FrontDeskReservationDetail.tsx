'use client';

import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { LogIn, User, MapPin, CalendarClock, CreditCard, Receipt, LogOut, ChevronDown, Edit3, XCircle, Loader2, Percent, Gift, Building2, BedDouble } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface FrontDeskReservationDetailProps {
  reservation: any;
  /** Set true when rendered inside the Night Audit module */
  darkMode?: boolean;
}

const STATUS_DARK: Record<string, string> = {
  CHECKED_IN:  'border-sky-400/30 bg-sky-400/10 text-sky-300',
  CHECKED_OUT: 'border-slate-600/30 bg-slate-600/10 text-slate-400',
  CONFIRMED:   'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  CANCELLED:   'border-rose-400/30 bg-rose-400/10 text-rose-300',
  NO_SHOW:     'border-amber-400/30 bg-amber-400/10 text-amber-300',
};

const STATUS_LIGHT: Record<string, string> = {
  CHECKED_IN:  'bg-blue-100 text-blue-800 border-blue-200',
  CHECKED_OUT: 'bg-slate-100 text-slate-800 border-slate-200',
  CONFIRMED:   'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED:   'bg-red-100 text-red-800 border-red-200',
};

export function FrontDeskReservationDetail({ reservation, darkMode = false }: FrontDeskReservationDetailProps) {
  const queryClient = useQueryClient();
  const { provider } = useLodgeCoreProvider();
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

  const { data: creditsData } = useQuery({
    queryKey: ['guest-credits', guest?.id],
    queryFn: async () => {
      if (!guest?.id || !reservation.propertyId) return { availableCredit: 0 };
      const res = await provider.guestCredits.list(reservation.propertyId);
      const guestCredit = res?.credits?.find((c: any) => c.guestId === guest.id);
      return { availableCredit: guestCredit?.availableAmount || 0 };
    },
    enabled: !!guest?.id && !!reservation.propertyId,
  });
  const availableCredit = creditsData?.availableCredit || 0;

  const balance = folio?.balance || 0;
  const isPaid = balance <= 0;
  const canCheckIn = reservation.status === 'CONFIRMED' && room;
  const canCheckOut = reservation.status === 'CHECKED_IN';
  const canAddPayment = ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status) && !!folio && folio.type !== 'CITY_LEDGER';
  const canExtendStay = reservation.status === 'CHECKED_IN';
  const canReassignRoom = ['CONFIRMED', 'CHECKED_IN'].includes(reservation.status);
  const canEditReservation = reservation.status === 'CONFIRMED';
  const canCancelReservation = reservation.status === 'CONFIRMED';
  const canManageReservation = canEditReservation || canReassignRoom || canCancelReservation;
  const hasRoomAdjustment = Boolean(resRoom && (
    resRoom.discountType === 'COMPLIMENTARY' || resRoom.discountType === 'FIXED_AMOUNT' ||
    resRoom.discountType === 'PERCENTAGE' || Number(resRoom.discountAmount || 0) > 0 ||
    Number(resRoom.discountPercent || 0) > 0
  ));
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

  /* ── Rate calculation (shared) ─────────────────────────────────── */
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

  /* ── Sub-dialog block (shared across both themes) ───────────────── */
  const subDialogs = (
    <>
      {isCheckInDialogOpen && <FrontDeskCheckInDialog reservationId={reservation.id} propertyId={reservation.propertyId} open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen} />}
      {isEditDialogOpen && <FrontDeskEditReservationDialog reservation={reservation} open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />}
      {isReassignDialogOpen && <FrontDeskReassignRoomDialog reservation={reservation} open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen} />}
      {isCancelDialogOpen && <FrontDeskCancelReservationDialog reservation={reservation} open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen} />}
      {isAddPaymentOpen && folio && <FrontDeskAddPaymentDialog folio={folio} open={isAddPaymentOpen} onOpenChange={setIsAddPaymentOpen} />}
      {isExtendStayOpen && <FrontDeskExtendStayDialog reservation={reservation} open={isExtendStayOpen} onOpenChange={setIsExtendStayOpen} />}
      {isReceiptOpen && latestPayment && (
        <FrontDeskReceiptDialog paymentId={latestPayment.id} open={isReceiptOpen} onOpenChange={setIsReceiptOpen}
          localData={{
            receiptId: latestPayment.reference || `RCPT-${latestPayment.id.substring(0, 8).toUpperCase()}`,
            property: reservation.property || { name: 'LodgeCore' },
            guest: guest ? { name: `${guest.firstName} ${guest.lastName}`, email: guest.email } : null,
            reservation: { confirmationNumber: reservation.confirmationNumber, roomNumber: formatRoomNumber(room?.number) || 'Unassigned', checkIn: reservation.checkIn, checkOut: reservation.checkOut },
            folio: { id: folio.id, totalCharges: Number(folio.totalCharges || 0), totalPayments: Number(folio.totalPayments || 0), balance: Number(folio.balance || 0) },
            payment: { ...latestPayment, date: latestPayment.createdAt, amount: Number(latestPayment.amount), providerTransactionId: latestPayment.providerTransactionId || latestPayment.reference },
          }}
        />
      )}
      {isQuickCheckoutOpen && <FrontDeskQuickCheckoutDialog open={isQuickCheckoutOpen} onOpenChange={setIsQuickCheckoutOpen} propertyId={reservation.propertyId} initialReservation={reservation} />}
      {isDiscountOpen && resRoom && (
        <FrontDeskDiscountModal isOpen={isDiscountOpen} targetType="RESERVATION_ROOM" targetId={resRoom.id} targetTotal={Number(resRoom.rateAmount || 0)}
          onClose={() => setIsDiscountOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] }); setIsDiscountOpen(false); }} />
      )}
      {isComplimentaryOpen && resRoom && (
        <FrontDeskComplimentaryModal isOpen={isComplimentaryOpen} targetType="RESERVATION_ROOM" targetId={resRoom.id} targetTotal={Number(resRoom.rateAmount || 0)}
          onClose={() => setIsComplimentaryOpen(false)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] }); setIsComplimentaryOpen(false); }} />
      )}
    </>
  );

  /* ══════════════════════════════════════════════════════════════════
     DARK MODE — Night Audit
  ══════════════════════════════════════════════════════════════════ */
  if (darkMode) {
    const GLASS = { background: 'rgba(255,255,255,0.03)' };
    const GLASS_BORDER = 'border border-white/[0.06]';
    const statusCls = STATUS_DARK[reservation.status] ?? 'border-slate-600/30 bg-slate-600/10 text-slate-400';
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6" style={{ background: '#060b18', minHeight: '100%' }}>
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">Reservation Detail</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-white">#{reservation.id.slice(0, 8).toUpperCase()}</h2>
            <p className="mt-1 text-sm text-slate-500">Created on {format(new Date(reservation.createdAt), 'PPP')}</p>
          </div>
          <Badge variant="outline" className={`rounded-full border px-4 py-1.5 text-sm font-bold ${statusCls}`}>{reservation.status.replace(/_/g, ' ')}</Badge>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left */}
          <div className="space-y-4 lg:col-span-4">
            {/* Guest card */}
            <div className={`overflow-hidden rounded-[20px] ${GLASS_BORDER}`} style={GLASS}>
              <div className="flex items-center gap-4 border-b border-white/[0.06] px-6 py-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {guest?.firstName?.[0]}{guest?.lastName?.[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{guest?.firstName} {guest?.lastName}</h3>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500"><User className="h-3 w-3" /> Guest</p>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Contact</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-300">{guest?.phone || 'No phone provided'}</p>
                <p className="mt-0.5 text-xs text-slate-500">{guest?.email || 'No email'}</p>
              </div>
              {availableCredit > 0 && (
                <div className="border-t border-white/[0.06] px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-blue-400">Available credit</p>
                    <p className="font-bold text-white text-sm">{formatCurrency(availableCredit, folio?.currency)}</p>
                  </div>
                  <button
                    onClick={() => {
                      document.querySelector<HTMLButtonElement>('button:has(svg.lucide-wallet)')?.click();
                    }}
                    className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-400 hover:text-blue-300 bg-blue-400/10 hover:bg-blue-400/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    View / Apply
                  </button>
                </div>
              )}
            </div>
            {/* Corporate */}
            {corporateAccount ? (
              <div className={`rounded-[20px] p-5 ${GLASS_BORDER} border-indigo-400/20`} style={{ background: 'rgba(99,102,241,0.07)' }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-400"><Building2 className="h-4 w-4" /></span>
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
            {/* Stay info */}
            <div className={`rounded-[20px] ${GLASS_BORDER}`} style={GLASS}>
              <div className="space-y-5 px-5 py-5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Room Assignment</p>
                  <div className="mt-2 flex items-center gap-2">
                    <BedDouble className="h-5 w-5 text-sky-400" />
                    <span className="text-xl font-bold text-white">Room {room?.number || 'Unassigned'}</span>
                    {room && <span className="text-sm text-slate-500">({room.roomType?.name})</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[['Check-In', resRoom?.checkIn], ['Check-Out', resRoom?.checkOut]].map(([lbl, d]) => (
                    <div key={String(lbl)} className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-3 text-center">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{String(lbl)}</p>
                      <p className="mt-1.5 text-sm font-bold text-white">{d ? format(new Date(String(d)), 'MMM d, yyyy') : 'N/A'}</p>
                    </div>
                  ))}
                </div>
                {/* Rate */}
                <div className="border-t border-white/[0.05] pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Rate Details</p>
                    {canAddRoomAdjustment && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setIsDiscountOpen(true)} className="flex h-7 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-[10px] font-bold text-slate-400 transition-colors hover:text-slate-200"><Percent className="h-3 w-3" /> Discount</button>
                        <button onClick={() => setIsComplimentaryOpen(true)} className="flex h-7 items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-400/20"><Gift className="h-3 w-3" /> Comp</button>
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
                          {resRoom?.discountReason && <span className="max-w-[110px] truncate text-[10px] text-slate-600" title={resRoom.discountReason}>({resRoom.discountReason})</span>}
                        </div>
                        <span className={`font-bold ${isComplimentaryRate ? 'text-emerald-300' : 'text-sky-300'}`}>-{formatCurrency(deductionAmount)}</span>
                      </div>
                    )}
                    {isPendingDiscount && <p className="text-[10px] font-semibold text-amber-400">Pending night-audit approval — provisional rate shown</p>}
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
            {/* Actions */}
            <div className="space-y-2.5">
              <p className="ml-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Quick Actions</p>
              {canCheckIn && <button onClick={() => setIsCheckInDialogOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white" style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}><LogIn className="h-5 w-5" /> Check In</button>}
              {canCheckOut && <button onClick={() => setIsQuickCheckoutOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><LogOut className="h-5 w-5" /> Check Out</button>}
              <div className="grid grid-cols-2 gap-2">
                {canAddPayment && <button onClick={() => setIsAddPaymentOpen(true)} className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] ${!canExtendStay ? 'col-span-2' : ''}`}><CreditCard className="h-4 w-4" /> Add Payment</button>}
                {canExtendStay && <button onClick={() => setIsExtendStayOpen(true)} className={`flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07] ${!canAddPayment ? 'col-span-2' : ''}`}><CalendarClock className="h-4 w-4" /> Extend Stay</button>}
                {latestPayment && <button onClick={handlePrintReceipt} disabled={isPrinting} className={`${canAddPayment || canExtendStay ? 'col-span-2' : ''} flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 disabled:opacity-50`}>{isPrinting ? <><Loader2 className="h-4 w-4 animate-spin" /> Printing…</> : <><Receipt className="h-4 w-4" /> Print Receipt</>}</button>}
                {canManageReservation && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="col-span-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] text-sm font-semibold text-slate-300 transition-all hover:bg-white/[0.07]">Manage Reservation <ChevronDown className="h-4 w-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl border-white/[0.08] p-2 shadow-2xl" style={{ background: '#0d1117' }}>
                      {canEditReservation && <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] focus:bg-white/[0.06]" onClick={() => setIsEditDialogOpen(true)}><Edit3 className="mr-2 h-4 w-4 text-slate-500" /> Edit Details</DropdownMenuItem>}
                      {canAddRoomAdjustment && <>
                        <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] focus:bg-white/[0.06]" onClick={() => setIsDiscountOpen(true)}><Percent className="mr-2 h-4 w-4 text-slate-500" /> Apply Discount</DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] focus:bg-white/[0.06]" onClick={() => setIsComplimentaryOpen(true)}><Gift className="mr-2 h-4 w-4 text-emerald-400" /> Set as Complimentary</DropdownMenuItem>
                      </>}
                      {canReassignRoom && <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-medium text-slate-300 hover:bg-white/[0.06] focus:bg-white/[0.06]" onClick={() => setIsReassignDialogOpen(true)}><MapPin className="mr-2 h-4 w-4 text-slate-500" /> Reassign Room</DropdownMenuItem>}
                      {canCancelReservation && <>
                        <DropdownMenuSeparator className="my-2 border-white/[0.06]" />
                        <DropdownMenuItem className="cursor-pointer rounded-lg p-3 font-semibold text-rose-400 hover:bg-rose-400/10 focus:bg-rose-400/10" onClick={() => setIsCancelDialogOpen(true)}><XCircle className="mr-2 h-4 w-4" /> Cancel Reservation</DropdownMenuItem>
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </div>
          {/* Right */}
          <div className="lg:col-span-8">
            <div className={`flex h-full flex-col overflow-hidden rounded-[20px] ${GLASS_BORDER}`} style={GLASS}>
              <div className={`flex items-center justify-between border-b border-white/[0.06] p-6 ${isPaid ? 'bg-emerald-400/[0.07]' : 'bg-rose-400/[0.07]'}`}>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isPaid ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{isPaid ? 'Fully Settled' : 'Outstanding Balance'}</p>
                  <p className={`mt-1 text-4xl font-black tracking-tight tabular-nums ${isPaid ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(balance)}</p>
                </div>
              </div>
              <div className="flex-1 space-y-6 p-6">
                {(reservation.status === 'CONFIRMED' || reservation.status === 'NO_SHOW') && (
                  <NoShowActions reservation={reservation} onUpdated={() => queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })} />
                )}
                <FolioSection reservation={reservation} />
                <FrontDeskCardInformationSection reservation={reservation} />
              </div>
            </div>
          </div>
        </div>
        {subDialogs}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     LIGHT MODE — Frontdesk (original design preserved exactly)
  ══════════════════════════════════════════════════════════════════ */
  const getStatusColor = (status: string) => STATUS_LIGHT[status] ?? 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Folio #{reservation.id.slice(0, 8).toUpperCase()}</h2>
          <p className="text-slate-500 font-medium">Created on {format(new Date(reservation.createdAt), 'PPP')}</p>
        </div>
        <Badge variant="outline" className={`px-4 py-1.5 rounded-full font-bold text-sm shadow-sm ${getStatusColor(reservation.status)}`}>{reservation.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xl uppercase">{guest?.firstName?.[0]}{guest?.lastName?.[0]}</div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{guest?.firstName} {guest?.lastName}</h3>
                <p className="text-slate-500 text-sm flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Guest</p>
              </div>
            </div>
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Contact</p>
                <p className="font-medium text-slate-700">{guest?.phone || 'No phone provided'}</p>
                <p className="text-sm text-slate-500">{guest?.email || 'No email'}</p>
              </div>
            </CardContent>
            {availableCredit > 0 && (
              <div className="px-6 py-4 border-t border-slate-100 bg-blue-50/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-0.5">Available credit</p>
                  <p className="font-bold text-slate-800">{formatCurrency(availableCredit, folio?.currency)}</p>
                </div>
                <button
                  onClick={() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Apply Guest Credit'));
                    if (btn) btn.click();
                    else document.querySelector('.lucide-receipt')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  View / Apply
                </button>
              </div>
            )}
          </Card>

          {corporateAccount ? (
            <Card className="rounded-3xl border-indigo-200 shadow-sm bg-indigo-50/60">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700"><Building2 className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Corporate Reservation</p>
                    <p className="font-bold text-indigo-950">{corporateAccount.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Account Code</p><p className="font-semibold text-indigo-900">{corporateAccount.code || 'N/A'}</p></div>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Deposit Policy</p><p className="font-semibold text-indigo-900">{corporateAccount.depositPolicy === 'WAIVED' ? 'Waived' : 'Required'}</p></div>
                </div>
              </CardContent>
            </Card>
          ) : reservation.corporateAccountId ? (
            <Card className="rounded-3xl border-amber-200 shadow-sm bg-amber-50">
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Corporate Link Missing Offline</p>
                <p className="mt-1 text-sm font-medium text-amber-900">Sync corporate accounts before checking in this reservation.</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-3xl border-slate-200 shadow-sm bg-white">
            <CardContent className="p-6 space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Room Assignment</p>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <span className="text-xl font-bold text-slate-900">Room {room?.number || 'Unassigned'}</span>
                  {room && <span className="text-sm text-slate-500 font-medium">({room.roomType?.name})</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Check-In</p><p className="font-bold text-slate-800">{resRoom?.checkIn ? format(new Date(resRoom.checkIn), 'MMM d, yyyy') : 'N/A'}</p></div>
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Check-Out</p><p className="font-bold text-slate-800">{resRoom?.checkOut ? format(new Date(resRoom.checkOut), 'MMM d, yyyy') : 'N/A'}</p></div>
              </div>
              <div className="pt-5 border-t border-slate-100 mt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rate Details</p>
                  {canAddRoomAdjustment && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 rounded-lg font-bold text-xs border-slate-200 hover:bg-slate-50" onClick={() => setIsDiscountOpen(true)}><Percent className="w-3.5 h-3.5 mr-1 text-slate-500" /> Discount</Button>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setIsComplimentaryOpen(true)}><Gift className="w-3.5 h-3.5 mr-1" /> Comp</Button>
                    </div>
                  )}
                </div>
                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/60 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-slate-500">{hasCorporateRate ? 'Corporate Nightly Rate' : 'Base Nightly Rate'}</span>
                    <span className="font-bold text-slate-700">{formatCurrency(baseRate, rateCurrency)}</span>
                  </div>
                  {hasDeduction && (
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isComplimentaryRate ? 'text-emerald-600' : 'text-blue-600'}`}>{deductionLabel}</span>
                        {resRoom?.discountReason && <span className="text-xs text-slate-400 truncate max-w-[120px]" title={resRoom.discountReason}>({resRoom.discountReason})</span>}
                      </div>
                      <span className={`font-bold ${isComplimentaryRate ? 'text-emerald-600' : 'text-blue-600'}`}>-{formatCurrency(deductionAmount)}</span>
                    </div>
                  )}
                  {isPendingDiscount && <div className="text-xs font-semibold text-amber-600">Pending night-audit approval — provisional rate shown</div>}
                  <div className="pt-3 border-t border-slate-200/60 flex justify-between items-center">
                    <span className="font-bold text-slate-900">Effective Rate</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(finalRate)}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase">/ night</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Quick Actions</p>
            {canCheckIn && <Button onClick={() => setIsCheckInDialogOpen(true)} className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-sm"><LogIn className="w-5 h-5 mr-2" /> Check In</Button>}
            {canCheckOut && <Button onClick={() => setIsQuickCheckoutOpen(true)} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-sm"><LogOut className="w-5 h-5 mr-2" /> Check Out</Button>}
            <div className="grid grid-cols-2 gap-3">
              {canAddPayment && <Button variant="outline" className="h-12 rounded-xl font-semibold border-slate-200" onClick={() => setIsAddPaymentOpen(true)}><CreditCard className="w-4 h-4 mr-2" /> Add Payment</Button>}
              {canExtendStay && <Button variant="outline" className="h-12 rounded-xl font-semibold border-slate-200" onClick={() => setIsExtendStayOpen(true)}><CalendarClock className="w-4 h-4 mr-2" /> Extend Stay</Button>}
              {latestPayment && <Button variant="outline" disabled={isPrinting} className={`${canAddPayment || canExtendStay ? 'col-span-2' : ''} h-12 rounded-xl font-semibold border-slate-200`} onClick={handlePrintReceipt}>{isPrinting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Printing...</> : <><Receipt className="w-4 h-4 mr-2" /> Print Receipt</>}</Button>}
              {canManageReservation && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="col-span-2 h-12 rounded-xl font-semibold border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-sm shadow-sm transition-colors w-full">Manage Reservation <ChevronDown className="w-4 h-4 ml-2" /></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl border-slate-200 shadow-xl">
                    {canEditReservation && <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsEditDialogOpen(true)}><Edit3 className="w-4 h-4 mr-2 text-slate-500" /> Edit Details</DropdownMenuItem>}
                    {canAddRoomAdjustment && <>
                      <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsDiscountOpen(true)}><Percent className="w-4 h-4 mr-2 text-slate-500" /> Apply Discount</DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsComplimentaryOpen(true)}><Gift className="w-4 h-4 mr-2 text-emerald-600" /> Set as Complimentary</DropdownMenuItem>
                    </>}
                    {canReassignRoom && <DropdownMenuItem className="rounded-lg p-3 cursor-pointer font-medium" onClick={() => setIsReassignDialogOpen(true)}><MapPin className="w-4 h-4 mr-2 text-slate-500" /> Reassign Room</DropdownMenuItem>}
                    {canCancelReservation && <>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem className="rounded-lg p-3 cursor-pointer text-red-600 font-semibold focus:text-red-700 focus:bg-red-50" onClick={() => setIsCancelDialogOpen(true)}><XCircle className="w-4 h-4 mr-2" /> Cancel Reservation</DropdownMenuItem>
                    </>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
            <div className={`p-8 border-b flex justify-between items-center ${isPaid ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${isPaid ? 'text-emerald-600' : 'text-red-600'}`}>{isPaid ? 'Fully Settled' : 'Outstanding Balance'}</p>
                <div className={`text-4xl font-black tracking-tight mt-1 ${isPaid ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(balance)}</div>
              </div>
            </div>
            <div className="p-8 flex-1 bg-slate-50 space-y-8">
              {(reservation.status === 'CONFIRMED' || reservation.status === 'NO_SHOW') && (
                <NoShowActions reservation={reservation} onUpdated={() => queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })} />
              )}
              <FolioSection reservation={reservation} />
              <FrontDeskCardInformationSection reservation={reservation} />
            </div>
          </div>
        </div>
      </div>
      {subDialogs}
    </div>
  );
}
