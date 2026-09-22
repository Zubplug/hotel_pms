import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import {
  CreditCard, Banknote, Building2, User, Loader2, Gift, ArrowLeft,
  Search, Hotel, CheckCircle2, Printer, ShieldCheck, X,
} from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InHouseGuest {
  reservationId: string;
  folioId: string;
  folioBalance: number;
  currency: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  isVip: boolean;
}

interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onCharge: (method: string, reference?: string, roomChargeData?: { folioId: string; reservationId: string; supervisorPin: string }) => Promise<void>;
  onPrintReceipt: () => Promise<void>;
  isProcessing: boolean;
  posSessionId?: string | null;
  bankingModel?: string;
  currentOperatorId?: string;
}

type View = 'methods' | 'roomCharge' | 'compSelection';

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
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // ── Room Charge ────────────────────────────────────────────────────
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<InHouseGuest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<InHouseGuest | null>(null);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset on open/close ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setView('methods');
      setErrorMsg(null);
      setGuestQuery('');
      setGuestResults([]);
      setSelectedGuest(null);
      setSupervisorPin('');
      setIsPinVisible(false);
      setSelectedStaffId('');
      setActiveStaff([]);
    }
  }, [isOpen]);

  // ── Load staff when comp view opens ───────────────────────────────
  useEffect(() => {
    if (view === 'compSelection' && activeStaff.length === 0) {
      const load = async () => {
        setIsLoadingStaff(true);
        try {
          const res = await provider.pos.getActiveStaff('ALL');
          if (res?.data) setActiveStaff(res.data);
        } catch { /* ignore */ }
        finally { setIsLoadingStaff(false); }
      };
      load();
    }
  }, [view, provider.pos, activeStaff.length]);

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
    if (!selectedStaffId) { setErrorMsg('Please select a beneficiary staff member.'); return; }
    setErrorMsg(null);
    onCharge('COMPLIMENTARY', `STAFF:${selectedStaffId}`);
  };

  const handleRoomChargeConfirm = async () => {
    if (!selectedGuest) { setErrorMsg('Please select a guest.'); return; }
    if (!supervisorPin.trim()) { setErrorMsg('A supervisor PIN is required to post a room charge.'); return; }
    setErrorMsg(null);
    await onCharge('ROOM_CHARGE', undefined, {
      folioId: selectedGuest.folioId,
      reservationId: selectedGuest.reservationId,
      supervisorPin: supervisorPin.trim(),
    });
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
      <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-50 border-0 rounded-[2rem]">

        {/* ── Header ── */}
        <div className="bg-indigo-600 px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <DialogTitle className="text-indigo-100 font-bold text-sm tracking-widest uppercase mb-2 relative z-10">
            {headerLabel}
          </DialogTitle>
          <div className="text-5xl font-black text-white tracking-tight relative z-10">
            {formatCurrency(total)}
          </div>
          <DialogDescription className="sr-only">Select payment method to complete the transaction.</DialogDescription>
        </div>

        {/* ── Content ── */}
        <div className="p-8 pb-10 relative">

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
                      <span className="text-xs font-black text-indigo-700">{g.roomNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1">
                        {g.guestName}
                        {g.isVip && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">VIP</span>}
                      </p>
                      <p className="text-xs text-slate-500">Room {g.roomNumber}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-slate-700">{formatCurrency(g.folioBalance)}</p>
                      <p className="text-[10px] text-slate-400">balance</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Room Charge: confirmation + supervisor PIN ── */}
          {view === 'roomCharge' && selectedGuest && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <BackButton onClick={() => { setSelectedGuest(null); setSupervisorPin(''); setErrorMsg(null); }} label="Change Guest" />

              {/* Selected guest summary */}
              <div className="mb-5 p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Charging to Folio</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-white">{selectedGuest.roomNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 truncate flex items-center gap-1">
                      {selectedGuest.guestName}
                      {selectedGuest.isVip && <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">VIP</span>}
                    </p>
                    <p className="text-sm text-slate-500">Room {selectedGuest.roomNumber}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-slate-600">{formatCurrency(selectedGuest.folioBalance)}</p>
                    <p className="text-[10px] text-slate-400">current balance</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-indigo-200 flex justify-between text-xs">
                  <span className="text-slate-500">Charge amount</span>
                  <span className="font-black text-indigo-700">{formatCurrency(total)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-slate-500">New folio balance</span>
                  <span className="font-bold text-slate-700">{formatCurrency(selectedGuest.folioBalance + total)}</span>
                </div>
              </div>

              {/* Supervisor PIN */}
              <div className="mb-5">
                <label htmlFor="pos-supervisor-pin" className="block text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  Supervisor PIN Required
                </label>
                <div className="relative">
                  <input
                    id="pos-supervisor-pin"
                    type={isPinVisible ? 'text' : 'password'}
                    inputMode="numeric"
                    autoFocus
                    placeholder="Enter supervisor PIN…"
                    value={supervisorPin}
                    onChange={(e) => { setSupervisorPin(e.target.value); setErrorMsg(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && supervisorPin) handleRoomChargeConfirm(); }}
                    className="w-full h-12 px-4 pr-12 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm font-medium tracking-widest"
                    maxLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPinVisible(!isPinVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    tabIndex={-1}
                  >
                    {isPinVisible ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Confirm button */}
              <button
                id="pos-room-charge-confirm"
                onClick={handleRoomChargeConfirm}
                disabled={isProcessing || !supervisorPin.trim()}
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
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Select Beneficiary Staff</label>
                  {isLoadingStaff ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading staff list...
                    </div>
                  ) : (
                    <Select value={selectedStaffId} onValueChange={(v) => setSelectedStaffId(v || '')}>
                      <SelectTrigger className="w-full h-12 rounded-xl bg-white border-slate-200">
                        <SelectValue placeholder="Choose a staff member..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeStaff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.firstName} {s.lastName} {s.department ? `(${s.department})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <button
                  onClick={handleComplimentaryCharge}
                  disabled={isProcessing || !selectedStaffId}
                  className="w-full h-14 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-4 shadow-sm"
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

