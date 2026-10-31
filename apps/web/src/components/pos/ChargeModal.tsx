import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import {
  CreditCard, Banknote, Building2, User, Loader2, Gift, ArrowLeft,
  Search, Hotel, CheckCircle2, Printer, X, Coffee, Minus, Plus,
} from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { COMPLIMENTARY_REASONS, complimentaryReasonLabel } from '@/lib/complimentary-reasons';

interface InHouseGuest {
  reservationId: string;
  guestId?: string;
  folioId: string;
  folioBalance: number;
  outstandingBalance?: number;
  availableCredit?: number;
  currency: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  isVip: boolean;
  complimentaryFoodQualifiedLastAudit?: boolean;
}

const displayRoomNumber = (roomNumber: string | null | undefined) => {
  const value = String(roomNumber || '').trim();
  return value.includes('.') ? value.split('.').pop() || value : value;
};

interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onCharge: (
    method: string,
    reference?: string,
    roomChargeData?: {
      folioId: string;
      reservationId: string;
      guestName: string;
      roomNumber: string;
      breakfastRedemption?: {
        reservationId: string;
        roomNumber: string;
        coversRedeemed: number;
      };
      complimentary?: {
        beneficiaryType: 'GUEST' | 'STAFF';
        beneficiaryGuestId?: string;
        beneficiaryStaffId?: string;
        acknowledgedByStaffId: string;
        reason: string;
        settlementType?: 'DUTY_MANAGER' | 'STAFF_PAY_LATER';
      };
    }
  ) => Promise<void>;
  onPrintReceipt: () => Promise<void>;
  isProcessing: boolean;
  posSessionId?: string | null;
  bankingModel?: string;
  currentOperatorId?: string;
}

type View = 'methods' | 'roomCharge' | 'compSelection';

const MANAGEMENT_ACKNOWLEDGER_ROLES = [
  'CEO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'HOTEL_MANAGER',
  'MANAGER', 'FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER',
  'FINANCE_MANAGER', 'ACCOUNTANT', 'NIGHT_AUDITOR', 'OUTLET_MANAGER',
  'DEPARTMENT_HEAD', 'HOD',
].join(',');

export function ChargeModal({
  isOpen,
  onClose,
  total,
  onCharge,
  onPrintReceipt,
  isProcessing,
  posSessionId,
  bankingModel = 'CENTRAL_CASHIER',
  currentOperatorId,
}: ChargeModalProps) {
  const { provider } = useLodgeCoreProvider();

  // ── General state ──────────────────────────────────────────────────
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [view, setView] = useState<View>('methods');

  // ── Complimentary ──────────────────────────────────────────────────
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [managementStaff, setManagementStaff] = useState<any[]>([]);
  const [beneficiaryType, setBeneficiaryType] = useState<'GUEST' | 'STAFF'>('GUEST');
  const [beneficiaryGuestId, setBeneficiaryGuestId] = useState('');
  const [beneficiaryGuestFolioId, setBeneficiaryGuestFolioId] = useState('');
  const [beneficiaryGuestReservationId, setBeneficiaryGuestReservationId] = useState('');
  const [beneficiaryStaffId, setBeneficiaryStaffId] = useState('');
  const [acknowledgedByStaffId, setAcknowledgedByStaffId] = useState('');
  const [complimentaryReason, setComplimentaryReason] = useState('');
  const [staffSettlementType, setStaffSettlementType] = useState<'DUTY_MANAGER' | 'STAFF_PAY_LATER'>('DUTY_MANAGER');
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // ── Room Charge ────────────────────────────────────────────────────
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<InHouseGuest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<InHouseGuest | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Breakfast Entitlement State ─────────────────────────────────────
  const [entitlement, setEntitlement] = useState<{
    eligible: boolean;
    reason?: string;
    reasonMessage?: string;
    maxCoversAllowed: number;
    coversAlreadyRedeemed: number;
    remainingCovers: number;
  } | null>(null);
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(false);
  const [selectedCovers, setSelectedCovers] = useState(1);

  // ── Reset on open/close ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setView('methods');
      setErrorMsg(null);
      setGuestQuery('');
      setGuestResults([]);
      setSelectedGuest(null);
      setBeneficiaryType('GUEST');
      setBeneficiaryGuestId('');
      setBeneficiaryGuestFolioId('');
      setBeneficiaryGuestReservationId('');
      setBeneficiaryStaffId('');
      setAcknowledgedByStaffId('');
      setComplimentaryReason('');
      setStaffSettlementType('DUTY_MANAGER');
      setActiveStaff([]);
      setManagementStaff([]);
      setEntitlement(null);
      setSelectedCovers(1);
    }
  }, [isOpen]);

  // ── Load staff when comp view opens ───────────────────────────────
  useEffect(() => {
    if (view === 'compSelection' && activeStaff.length === 0) {
      const load = async () => {
        setIsLoadingStaff(true);
        try {
          const [posStaff, management] = await Promise.all([
            provider.auth.getActiveStaff(),
            provider.auth.getActiveStaff(MANAGEMENT_ACKNOWLEDGER_ROLES),
          ]);
          if (posStaff?.data) setActiveStaff(posStaff.data);
          if (management?.data) setManagementStaff(management.data);
        } catch { /* ignore */ }
        finally { setIsLoadingStaff(false); }
      };
      load();
    }
  }, [view, provider.auth, provider.pos, activeStaff.length]);

  // ── Guest search (debounced) ───────────────────────────────────────
  const searchGuests = useCallback(async (q: string) => {
    setIsSearching(true);
    try {
      const res = await provider.pos.getInHouseGuests(q);
      setGuestResults(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setGuestResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [provider.pos]);

  useEffect(() => {
    if (view !== 'roomCharge' || selectedGuest) return;
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => searchGuests(guestQuery), 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [guestQuery, view, selectedGuest, searchGuests]);

  // Load all guests when room-charge view first opens
  useEffect(() => {
    if (view === 'roomCharge' && guestResults.length === 0 && !selectedGuest) {
      searchGuests('');
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Complimentary beneficiaries use the same local, checked-in guest
  // snapshot as room charges. This must not depend on network access.
  useEffect(() => {
    if (view === 'compSelection' && beneficiaryType === 'GUEST' && guestResults.length === 0) {
      searchGuests('');
    }
  }, [view, beneficiaryType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch breakfast entitlement whenever selectedGuest is set
  useEffect(() => {
    if (!selectedGuest) {
      setEntitlement(null);
      return;
    }
    let isCancelled = false;
    const fetchEntitlement = async () => {
      setIsLoadingEntitlement(true);
      try {
        const res = await provider.pos.getBreakfastEntitlement(
          selectedGuest.reservationId,
          displayRoomNumber(selectedGuest.roomNumber),
        );
        if (!isCancelled && res?.data) {
          setEntitlement(res.data);
          if (res.data.remainingCovers > 0) {
            setSelectedCovers(Math.max(1, res.data.remainingCovers));
          }
        }
      } catch {
        if (!isCancelled) setEntitlement(null);
      } finally {
        if (!isCancelled) setIsLoadingEntitlement(false);
      }
    };
    fetchEntitlement();
    return () => { isCancelled = true; };
  }, [selectedGuest, provider.pos]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCharge = (method: string) => {
    setErrorMsg(null);
    if (!posSessionId && method !== 'COMPLIMENTARY') {
      if (bankingModel === 'CENTRAL_CASHIER') {
        setErrorMsg('Waiters cannot process payments. Please direct the guest to the Cashier to complete this transaction.');
        return;
      } else if (bankingModel === 'SERVER_BANKING') {
        setErrorMsg('No personal bank found. Please start your personal shift bank before processing payments.');
        return;
      }
    }
    onCharge(method);
  };

  const handleComplimentaryCharge = () => {
    if (beneficiaryType === 'GUEST' && !beneficiaryGuestId) { setErrorMsg('Please select the checked-in guest beneficiary.'); return; }
    if (beneficiaryType === 'STAFF' && !beneficiaryStaffId) { setErrorMsg('Please select the staff beneficiary.'); return; }
    if (!acknowledgedByStaffId) { setErrorMsg('Please select who acknowledged this complimentary benefit.'); return; }
    if (!complimentaryReason) { setErrorMsg('Please select a reason for the complimentary benefit.'); return; }
    setErrorMsg(null);
    onCharge('COMPLIMENTARY', undefined, {
      folioId: beneficiaryType === 'GUEST' ? beneficiaryGuestFolioId : '',
      reservationId: beneficiaryType === 'GUEST' ? beneficiaryGuestReservationId : '', guestName: '', roomNumber: '',
      complimentary: {
        beneficiaryType,
        beneficiaryGuestId: beneficiaryType === 'GUEST' ? beneficiaryGuestId : undefined,
        beneficiaryStaffId: beneficiaryType === 'STAFF' ? beneficiaryStaffId : undefined,
        acknowledgedByStaffId,
        reason: complimentaryReasonLabel(complimentaryReason),
        settlementType: beneficiaryType === 'STAFF' ? staffSettlementType : 'DUTY_MANAGER',
      },
    });
  };

  const handleRoomChargeConfirm = async () => {
    if (!selectedGuest) { setErrorMsg('Please select a guest.'); return; }
    setErrorMsg(null);
    await onCharge('ROOM_CHARGE', undefined, {
      folioId: selectedGuest.folioId,
      reservationId: selectedGuest.reservationId,
      guestName: selectedGuest.guestName,
      roomNumber: displayRoomNumber(selectedGuest.roomNumber),
    });
  };

  const handleRedeemBreakfast = async () => {
    if (!selectedGuest || !entitlement?.eligible) return;
    setErrorMsg(null);
    await onCharge('COMPLIMENTARY', `BREAKFAST_ENTITLEMENT:${selectedCovers}`, {
      folioId: selectedGuest.folioId,
      reservationId: selectedGuest.reservationId,
      guestName: selectedGuest.guestName,
      roomNumber: displayRoomNumber(selectedGuest.roomNumber),
      breakfastRedemption: {
        reservationId: selectedGuest.reservationId,
        roomNumber: displayRoomNumber(selectedGuest.roomNumber),
        coversRedeemed: selectedCovers,
      },
    });
  };

  const formatFolioPosition = (guest: Pick<InHouseGuest, 'folioBalance' | 'availableCredit'>) => {
    const balance = Number(guest.folioBalance || 0);
    const availableCredit = Number(guest.availableCredit || 0);
    if (balance > 0.01) return { label: 'Due', color: 'text-rose-600', amount: balance };
    if (availableCredit > 0.01) return { label: 'Credit', color: 'text-emerald-600', amount: availableCredit };
    if (balance < -0.01) return { label: 'Credit', color: 'text-emerald-600', amount: Math.abs(balance) };
    return { label: 'Settled', color: 'text-slate-500', amount: 0 };
  };

  // ── Header label ───────────────────────────────────────────────────
  const headerLabel =
    view === 'compSelection' ? 'Complimentary Settlement'
    : view === 'roomCharge' ? (selectedGuest ? 'Confirm Room Charge' : 'Select Guest')
    : 'Total Amount Due';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isProcessing && !open) onClose();
    }}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg flex-col overflow-hidden rounded-[1.5rem] border-0 bg-slate-50 p-0 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[2rem]">

        {/* ── Header ── */}
        <div className="relative shrink-0 overflow-hidden bg-indigo-600 px-5 py-6 text-center sm:px-8 sm:py-8">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <DialogTitle className="text-indigo-100 font-bold text-sm tracking-widest uppercase mb-2 relative z-10">
            {headerLabel}
          </DialogTitle>
          <div className="relative z-10 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {formatCurrency(total)}
          </div>
          <DialogDescription className="sr-only">Select payment method to complete the transaction.</DialogDescription>
        </div>

        {/* ── Content ── */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-5 sm:p-6 sm:pb-7">

          {/* ── Payment methods ── */}
          {view === 'methods' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <button
                type="button"
                onClick={onPrintReceipt}
                disabled={isProcessing}
                className="w-full mb-6 h-12 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                PRINT CUSTOMER RECEIPT
              </button>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-4">
                {/* Cash */}
                <MethodButton icon={<Banknote />} label="Cash" color="emerald" disabled={isProcessing} onClick={() => handleCharge('CASH')} />
                {/* Card */}
                <MethodButton icon={<CreditCard />} label="Card" color="blue" disabled={isProcessing} onClick={() => handleCharge('CARD')} />
                {/* Transfer */}
                <MethodButton icon={<Building2 />} label="Transfer" color="purple" disabled={isProcessing} onClick={() => handleCharge('BANK_TRANSFER')} />
                {/* Room Charge */}
                <MethodButton
                  icon={<Hotel />}
                  label="Room Charge"
                  color="indigo"
                  disabled={isProcessing}
                  onClick={() => { setErrorMsg(null); setView('roomCharge'); }}
                />
                {/* Complimentary */}
                <MethodButton
                  icon={<Gift />}
                  label="Complimentary"
                  color="pink"
                  disabled={isProcessing}
                  onClick={() => { setErrorMsg(null); setView('compSelection'); }}
                  span2
                />
              </div>
            </div>
          )}

          {/* ── Room Charge: guest search ── */}
          {view === 'roomCharge' && !selectedGuest && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <BackButton onClick={() => { setView('methods'); setGuestQuery(''); setGuestResults([]); }} />

              {/* Search input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="pos-guest-search-input"
                  type="text"
                  autoFocus
                  placeholder="Search by guest name or room number…"
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium text-slate-700 placeholder:text-slate-400"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                )}
              </div>

              {/* Results list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {guestResults.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-slate-400">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No checked-in guests found</p>
                    {guestQuery && <p className="text-xs mt-1">Try a different name or room number</p>}
                  </div>
                )}
                {guestResults.map((g) => (
                  <button
                    key={g.reservationId}
                    id={`pos-guest-${g.reservationId}`}
                    onClick={() => { setSelectedGuest(g); setErrorMsg(null); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left transition-all group"
                  >
                    {/* Room number badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                      <span className="text-xs font-black text-indigo-700">{displayRoomNumber(g.roomNumber)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1">
                        {g.guestName}
                        {g.isVip && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">VIP</span>}
                      </p>
                      <p className="text-xs text-slate-500">Room {displayRoomNumber(g.roomNumber)}</p>
                      {g.complimentaryFoodQualifiedLastAudit && <p className="mt-0.5 text-[10px] font-bold text-amber-700">Qualified in last audit · complimentary food</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-bold ${formatFolioPosition(g).color}`}>{formatCurrency(formatFolioPosition(g).amount, g.currency)}</p>
                      <p className={`text-[10px] ${formatFolioPosition(g).color}`}>{formatFolioPosition(g).label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Room Charge: confirmation ── */}
          {view === 'roomCharge' && selectedGuest && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <BackButton onClick={() => { setSelectedGuest(null); setErrorMsg(null); }} label="Change Guest" />

              {/* Selected guest summary */}
              <div className="mb-5 p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Charging to Folio</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-white">{displayRoomNumber(selectedGuest.roomNumber)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 truncate flex items-center gap-1">
                      {selectedGuest.guestName}
                      {selectedGuest.isVip && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">VIP</span>}
                    </p>
                    <p className="text-sm text-slate-500">Room {displayRoomNumber(selectedGuest.roomNumber)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold ${formatFolioPosition(selectedGuest).color}`}>{formatCurrency(formatFolioPosition(selectedGuest).amount, selectedGuest.currency)}</p>
                    <p className={`text-[10px] ${formatFolioPosition(selectedGuest).color}`}>{formatFolioPosition(selectedGuest).label}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-indigo-200 flex justify-between text-xs">
                  <span className="text-slate-500">Charge amount</span>
                  <span className="font-black text-indigo-700">{formatCurrency(total)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-slate-500">New folio balance</span>
                  {(() => {
                    const currentDue = Math.max(0, Number(selectedGuest.folioBalance || 0));
                    const currentCredit = Math.max(0, Number(selectedGuest.availableCredit || 0), Number(selectedGuest.folioBalance || 0) < 0 ? Math.abs(Number(selectedGuest.folioBalance)) : 0);
                    const projectedDue = Math.max(0, currentDue + total - currentCredit);
                    const projectedCredit = Math.max(0, currentCredit - currentDue - total);
                    const position = projectedDue > 0.01
                      ? { label: 'Due', color: 'text-rose-600', amount: projectedDue }
                      : projectedCredit > 0.01
                        ? { label: 'Credit', color: 'text-emerald-600', amount: projectedCredit }
                        : { label: 'Settled', color: 'text-slate-500', amount: 0 };
                    return <span className={`font-bold ${position.color}`}>{formatCurrency(position.amount, selectedGuest.currency)} {position.label}</span>;
                  })()}
                </div>
              </div>

              {/* ── Breakfast Entitlement Card ── */}
              <div className="mb-5 p-4 rounded-2xl bg-amber-500/[.07] border border-amber-500/25">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-700">
                      <Coffee className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Complimentary Breakfast</span>
                  </div>
                  {isLoadingEntitlement ? (
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                    </span>
                  ) : entitlement?.eligible ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                      ELIGIBLE ({entitlement.remainingCovers} left)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                      NOT ELIGIBLE
                    </span>
                  )}
                </div>

                {isLoadingEntitlement ? (
                  <p className="text-xs text-slate-400 py-1">Verifying room entitlement...</p>
                ) : entitlement?.eligible ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      Entitlement: <span className="font-semibold text-slate-800">{entitlement.maxCoversAllowed} cover(s)</span> allowed. Claimed today: <span className="font-semibold text-slate-800">{entitlement.coversAlreadyRedeemed}</span>.
                    </p>

                    <div className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-amber-200/80">
                      <span className="text-xs font-semibold text-slate-600">Covers to Redeem:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCovers((c) => Math.max(1, c - 1))}
                          disabled={selectedCovers <= 1}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 flex items-center justify-center font-bold text-slate-700 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-black text-sm text-slate-800">
                          {selectedCovers}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCovers((c) => Math.min(entitlement.remainingCovers, c + 1))}
                          disabled={selectedCovers >= entitlement.remainingCovers}
                          className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 disabled:opacity-30 flex items-center justify-center font-bold text-amber-800 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      id="pos-breakfast-redeem-btn"
                      onClick={handleRedeemBreakfast}
                      disabled={isProcessing || selectedCovers <= 0}
                      className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wide text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <Coffee className="w-4 h-4" />
                      Redeem as Complimentary Breakfast (₦0.00)
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-900/80 bg-amber-100/50 p-2.5 rounded-lg border border-amber-200/50">
                    {entitlement?.reasonMessage || 'This stay is not entitled to complimentary breakfast.'}
                  </p>
                )}
              </div>

              {/* Confirm button */}
              <button
                id="pos-room-charge-confirm"
                onClick={handleRoomChargeConfirm}
                disabled={isProcessing}
                className="w-full h-14 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                {isProcessing
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
                  : <><Hotel className="w-5 h-5" /> Post Room Charge</>
                }
              </button>
            </div>
          )}

          {/* ── Complimentary ── */}
          {view === 'compSelection' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <BackButton onClick={() => setView('methods')} />
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[.16em] text-slate-500">Benefit recipient</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['GUEST', 'STAFF'] as const).map((type) => (
                      <button key={type} type="button" onClick={() => setBeneficiaryType(type)} className={`rounded-xl border px-3 py-3 text-sm font-bold transition-colors ${beneficiaryType === type ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50'}`}>
                        {type === 'GUEST' ? 'Guest / Customer' : 'Staff Member'}
                      </button>
                    ))}
                  </div>
                </div>

                {beneficiaryType === 'GUEST' && <div className="rounded-2xl border border-slate-200 bg-white p-4"><label className="mb-2 block text-sm font-bold text-slate-700">Checked-in guest</label><p className="mb-3 text-xs leading-5 text-slate-500">Select the guest who receives this benefit. The guest record is stored as the beneficiary.</p><input value={guestQuery} onChange={(e) => { setGuestQuery(e.target.value); setBeneficiaryGuestId(''); setBeneficiaryGuestFolioId(''); setBeneficiaryGuestReservationId(''); }} placeholder="Search by guest name or room" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200" />{guestResults.length > 0 && <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{guestResults.map((guest) => <button type="button" key={guest.reservationId} onClick={() => { const id = guest.guestId || ''; setBeneficiaryGuestId(id); setBeneficiaryGuestFolioId(guest.folioId || ''); setBeneficiaryGuestReservationId(guest.reservationId); setGuestQuery(`${guest.guestName} · Room ${displayRoomNumber(guest.roomNumber)}`); setGuestResults([]); }} className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs transition ${beneficiaryGuestId === guest.guestId ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50'}`}><span className="font-bold text-slate-700">{guest.guestName}</span><span className="ml-2 text-slate-500">Room {displayRoomNumber(guest.roomNumber)}</span></button>)}</div>}</div>}

                {beneficiaryType === 'STAFF' && <div className="rounded-2xl border border-slate-200 bg-white p-4"><label className="mb-2 block text-sm font-bold text-slate-700">Staff beneficiary</label>{isLoadingStaff ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading staff list…</div> : <SearchableSelect value={beneficiaryStaffId} onChange={setBeneficiaryStaffId} placeholder="Choose a staff member…" searchPlaceholder="Search staff by name or department…" inputClassName="h-12 rounded-xl bg-slate-50 border-slate-200" options={activeStaff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}${s.department ? ` · ${s.department}` : ''}`, searchText: `${s.firstName} ${s.lastName} ${s.department || ''}` }))} />}</div>}

                {beneficiaryType === 'STAFF' && <div><label className="mb-2 block text-sm font-bold text-slate-700">Staff settlement</label><SearchableSelect value={staffSettlementType} onChange={(v) => setStaffSettlementType(v as 'DUTY_MANAGER' | 'STAFF_PAY_LATER')} searchPlaceholder="Search settlement types…" inputClassName="h-12 rounded-xl bg-white border-slate-200" options={[{ value: 'DUTY_MANAGER', label: 'Duty Manager · Free benefit', searchText: 'company sponsored duty meal benefit' }, { value: 'STAFF_PAY_LATER', label: 'Pay later · Staff receivable', searchText: 'pending approval staff receivable' }]} /><p className="mt-1.5 text-xs leading-5 text-slate-500">Pay-later benefits require review before becoming staff receivables.</p></div>}
                <div><label className="mb-2 block text-sm font-bold text-slate-700">Authorized by</label><SearchableSelect value={acknowledgedByStaffId} onChange={setAcknowledgedByStaffId} placeholder="Select management staff" searchPlaceholder="Search management staff…" inputClassName="h-12 rounded-xl bg-white border-slate-200" options={managementStaff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}${s.role ? ` · ${String(s.role).replaceAll('_', ' ')}` : ''}`, searchText: `${s.firstName} ${s.lastName} ${s.role || ''}` }))} /></div>
                <div><label className="mb-2 block text-sm font-bold text-slate-700">Reason</label><SearchableSelect value={complimentaryReason} onChange={setComplimentaryReason} placeholder="Select an approved reason" searchPlaceholder="Search approved reasons…" inputClassName="h-12 rounded-xl bg-white border-slate-200" options={COMPLIMENTARY_REASONS.map((option) => ({ value: option.value, label: option.label, searchText: option.label }))} /></div>
                <button
                  onClick={handleComplimentaryCharge}
                  disabled={isProcessing || !acknowledgedByStaffId || !complimentaryReason || (beneficiaryType === 'STAFF' && !beneficiaryStaffId) || (beneficiaryType === 'GUEST' && !beneficiaryGuestId)}
                  className="sticky bottom-0 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Complete as Complimentary'}
                </button>
              </div>
            </div>
          )}

          {/* ── Error banner ── */}
          {errorMsg && (
            <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium text-center flex items-start gap-2">
              <X className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* ── Processing overlay ── */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-[2rem]">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
            <p className="font-bold text-slate-700">Processing Payment…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function BackButton({ onClick, label = 'Back to Payment Methods' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800"
    >
      <ArrowLeft className="w-4 h-4 mr-1" /> {label}
    </button>
  );
}

const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  emerald: { bg: 'hover:bg-emerald-50', border: 'hover:border-emerald-200', text: 'hover:text-emerald-700', iconBg: 'group-hover:bg-emerald-100' },
  blue:    { bg: 'hover:bg-blue-50',    border: 'hover:border-blue-200',    text: 'hover:text-blue-700',    iconBg: 'group-hover:bg-blue-100' },
  purple:  { bg: 'hover:bg-purple-50',  border: 'hover:border-purple-200',  text: 'hover:text-purple-700',  iconBg: 'group-hover:bg-purple-100' },
  indigo:  { bg: 'hover:bg-indigo-50',  border: 'hover:border-indigo-200',  text: 'hover:text-indigo-700',  iconBg: 'group-hover:bg-indigo-100' },
  pink:    { bg: 'hover:bg-pink-50',    border: 'hover:border-pink-200',    text: 'hover:text-pink-700',    iconBg: 'group-hover:bg-pink-100' },
};

function MethodButton({
  icon, label, color, disabled, onClick, span2 = false,
}: {
  icon: React.ReactNode;
  label: string;
  color: keyof typeof colorMap;
  disabled: boolean;
  onClick: () => void;
  span2?: boolean;
}) {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md ${c.border} ${c.bg} text-slate-600 ${c.text} transition-all disabled:opacity-50 group${span2 ? ' col-span-2' : ''}`}
    >
      <div className={`w-12 h-12 rounded-full bg-slate-50 ${c.iconBg} flex items-center justify-center transition-colors [&_svg]:w-6 [&_svg]:h-6`}>
        {icon}
      </div>
      <span className="font-bold text-sm">{label}</span>
    </button>
  );
}
