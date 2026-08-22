'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User, AlertCircle, X, Banknote, ShieldAlert,
  ArrowLeft, Loader2, Check, ChevronRight
} from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

type Step = 'select' | 'pin' | 'shift' | 'error_central';

type StaffSwitchPadProps = {
  isOpen: boolean;
  onAuthenticated: (operator: any, token?: string) => void;
  onCancel?: () => void;
  cancellable?: boolean;
  outletId?: string;
};

export function StaffSwitchPad({
  isOpen,
  onAuthenticated,
  onCancel,
  cancellable = false,
  outletId,
}: StaffSwitchPadProps) {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';

  const [staff, setStaff] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [authData, setAuthData] = useState<{ operator: any; token: string } | null>(null);
  const floatRef = useRef<HTMLInputElement>(null);

  // Load staff on open
  useEffect(() => {
    if (!isOpen || !propertyId) return;
    setStaffLoading(true);
    provider.pos.getActiveStaff(propertyId)
      .then(res => { if (res.data) setStaff(res.data); })
      .catch(console.error)
      .finally(() => setStaffLoading(false));
  }, [isOpen, propertyId, provider]);

  // Reset every time pad opens
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedStaff(null);
      setPin('');
      setError('');
      setAuthData(null);
      setOpeningFloat('0');
    }
  }, [isOpen]);

  // Auto-focus float input on shift step
  useEffect(() => {
    if (step === 'shift') setTimeout(() => floatRef.current?.focus(), 100);
  }, [step]);

  const selectStaff = (s: any) => {
    setSelectedStaff(s);
    setPin('');
    setError('');
    setStep('pin');
  };

  const handleKey = (num: string) => {
    if (isLoading) return;
    const next = pin + num;
    if (next.length > 4) return;
    setPin(next);
    setError('');
    if (next.length === 4) submitPin(next);
  };

  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const submitPin = async (pinValue: string) => {
    if (!selectedStaff) return;
    setIsLoading(true);
    setError('');
    try {
      const existingSessionId =
        localStorage.getItem('lodgecore_pos_session_id') ||
        (session as any)?.sessionId || '';
      const finalOutletId =
        outletId ||
        (session as any)?.outletId ||
        localStorage.getItem('lodgecore_pos_outlet_id') || '';
      const deviceId =
        (session as any)?.deviceId ||
        localStorage.getItem('lodgecore_pos_device_id') || '';

      const res = await provider.pos.authenticateOperator(
        selectedStaff.id,
        pinValue,
        propertyId,
        existingSessionId,
        finalOutletId,
        deviceId
      );

      if (res.error || !res.data) {
        setError(res.error || 'Incorrect PIN. Try again.');
        setPin('');
        return;
      }

      const auth = res.data;
      const token: string = auth.operatorToken;
      const operator = auth.staff;

      // Central cashier model — till is closed
      if (auth.requiresBank) {
        setStep('error_central');
        return;
      }

      // Session already exists — go straight in, no shift prompt
      if (auth.posSessionId || auth.sessionId || existingSessionId) {
        if (auth.posSessionId || auth.sessionId) {
          localStorage.setItem('lodgecore_pos_session_id', auth.posSessionId || auth.sessionId);
        }
        onAuthenticated(operator, token);
        return;
      }

      // No session, server banking model — need to open a shift
      if (auth.bankingModel === 'SERVER_BANKING') {
        setAuthData({ operator, token });
        setStep('shift');
        return;
      }

      // All other cases — straight in
      onAuthenticated(operator, token);
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const startShift = async () => {
    if (!authData) return;
    setIsLoading(true);
    setError('');
    try {
      const deviceId = localStorage.getItem('lodgecore_pos_device_id') || '';
      const finalOutletId =
        outletId || localStorage.getItem('lodgecore_pos_outlet_id') || '';
      const openingCash = parseFloat(openingFloat) || 0;

      if (isDesktopMode) {
        const res = await provider.pos.startSession({
          userId: authData.operator.id,
          propertyId,
          deviceId,
          outletId: finalOutletId,
          openingCash,
        });
        if (res?.data?.sessionId) {
          localStorage.setItem('lodgecore_pos_session_id', res.data.sessionId);
          onAuthenticated(authData.operator, authData.token);
        } else {
          setError(res?.error || 'Failed to start shift.');
        }
      } else {
        const res = await fetch('/api/v1/pos/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authData.token}`,
          },
          body: JSON.stringify({ propertyId, deviceId, outletId: finalOutletId, openingCash }),
        });
        const data = await res.json();
        if (res.ok && data.data?.sessionId) {
          localStorage.setItem('lodgecore_pos_session_id', data.data.sessionId);
          onAuthenticated(authData.operator, authData.token);
        } else {
          setError(data.error || 'Failed to start shift.');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start shift.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const initials = selectedStaff
    ? `${selectedStaff.firstName?.[0] || ''}${selectedStaff.lastName?.[0] || ''}`.toUpperCase()
    : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        style={{ maxWidth: 560, maxHeight: '90vh' }}
      >
        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            {step !== 'select' && (
              <button
                onClick={() => {
                  setError('');
                  setPin('');
                  setStep(step === 'shift' || step === 'error_central' ? 'pin' : 'select');
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors touch-manipulation"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">LodgeCore POS</p>
              <h2 className="text-sm font-black text-slate-800 leading-tight">
                {step === 'select' && 'Who is working today?'}
                {step === 'pin' && `Enter PIN — ${selectedStaff?.firstName}`}
                {step === 'shift' && 'Open Your Shift'}
                {step === 'error_central' && 'Till Not Open'}
              </h2>
            </div>
          </div>
          {cancellable && (
            <button
              onClick={onCancel}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors touch-manipulation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── SELECT STAFF ───────────────────────────── */}
        {step === 'select' && (
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
            {staffLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading staff...</span>
              </div>
            ) : staff.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No staff found. Check your property settings.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {staff.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectStaff(s)}
                    className="group flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 border-slate-100 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50 transition-all touch-manipulation active:scale-95"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                      {`${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase() || '?'}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-800 text-[11px] leading-tight truncate max-w-[70px]">
                        {s.firstName}
                      </p>
                      <p className="text-[9px] text-slate-400 font-medium truncate max-w-[70px]">
                        {s.role || s.position || 'Staff'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PIN PAD ────────────────────────────────── */}
        {step === 'pin' && (
          <div className="flex flex-1 overflow-hidden">
            {/* Left: operator context */}
            <div className="flex flex-col items-center justify-center bg-indigo-600 px-6 w-40 shrink-0 gap-3">
              <div className="w-14 h-14 rounded-full bg-white/20 text-white font-black text-lg flex items-center justify-center shadow-inner">
                {initials}
              </div>
              <div className="text-center">
                <p className="text-white font-black text-sm leading-tight">
                  {selectedStaff?.firstName}
                </p>
                <p className="text-indigo-200 text-[10px] font-medium">
                  {selectedStaff?.role || selectedStaff?.position || 'Staff'}
                </p>
              </div>
            </div>

            {/* Right: numpad */}
            <div className="flex-1 flex flex-col justify-between p-5">
              {/* PIN dots */}
              <div className="flex flex-col items-center gap-3 py-3">
                <p className="text-xs font-semibold text-slate-500">Enter 4-digit PIN</p>
                <div className="flex gap-3">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all duration-100 ${
                        i < pin.length ? 'bg-indigo-600 scale-125' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-bold bg-rose-50 px-3 py-1.5 rounded-lg">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              {/* Numpad grid */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button
                    key={n}
                    onClick={() => handleKey(n.toString())}
                    disabled={isLoading}
                    className="h-12 rounded-xl bg-slate-100 text-lg font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 disabled:opacity-40 transition-all touch-manipulation"
                  >
                    {n}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handleKey('0')}
                  disabled={isLoading}
                  className="h-12 rounded-xl bg-slate-100 text-lg font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 disabled:opacity-40 transition-all touch-manipulation"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  disabled={isLoading || pin.length === 0}
                  className="h-12 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 active:scale-95 disabled:opacity-40 flex items-center justify-center transition-all touch-manipulation"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SHIFT START ────────────────────────────── */}
        {step === 'shift' && (
          <div className="flex-1 flex flex-col p-5 gap-4">
            {/* Verified badge */}
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm leading-tight">
                  {authData?.operator?.firstName} {authData?.operator?.lastName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {authData?.operator?.role || authData?.operator?.position} · Identity verified
                </p>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-700 mb-1">Opening Float</label>
              <p className="text-xs text-slate-400 mb-2.5">
                Enter cash in your drawer to start. Set to 0 if not applicable.
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₦</span>
                <input
                  ref={floatRef}
                  type="number"
                  min="0"
                  step="100"
                  value={openingFloat}
                  onChange={e => setOpeningFloat(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                />
              </div>
              {error && (
                <div className="mt-2.5 flex items-center gap-1.5 text-rose-600 text-[11px] font-bold bg-rose-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <button
              onClick={startShift}
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 touch-manipulation"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Opening shift...</>
              ) : (
                <><Banknote className="w-4 h-4" /> Open Shift & Enter POS</>
              )}
            </button>
          </div>
        )}

        {/* ── CENTRAL CASHIER ERROR ──────────────────── */}
        {step === 'error_central' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">Central Till is Closed</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">
                A manager must open the main till first. Contact your supervisor.
              </p>
            </div>
            <button
              onClick={() => { setStep('select'); setPin(''); setError(''); }}
              className="px-5 py-2 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors touch-manipulation"
            >
              Back to Staff List
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
