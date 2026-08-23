'use client';

/**
 * TerminalAuthScreen
 *
 * A single, premium authentication UI used for both:
 *   - GLOBAL   → master terminal login on the /desktop page
 *   - POS_OPERATOR → operator switch / lock screen inside the POS app
 *
 * This component owns ONLY the UI and user interaction.
 * Business logic (API calls, session management, banking model logic)
 * lives in the hooks:
 *   - useGlobalTerminalAuth    (GLOBAL mode)
 *   - usePosOperatorAuth       (POS_OPERATOR mode)
 *
 * The two modes share:
 *   ✓ Staff selection grid
 *   ✓ PIN keypad with animated dots
 *   ✓ Error display
 *   ✓ Loading state
 *   ✓ Keyboard support
 *   ✓ Back navigation
 *   ✓ Animations
 *
 * Mode-specific panels:
 *   GLOBAL       → No extra steps after PIN (routes away on success)
 *   POS_OPERATOR → Shift float entry (SERVER_BANKING) or Central Till error
 */

import React, { useEffect, useRef } from 'react';
import {
  ArrowLeft, X, Banknote, ShieldAlert, Loader2,
  Check, RefreshCw, Wifi, WifiOff, Lock,
} from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useGlobalTerminalAuth, type StaffProfile } from '@/lib/pos/useGlobalTerminalAuth';
import { usePosOperatorAuth } from '@/lib/pos/usePosOperatorAuth';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type AuthMode = 'GLOBAL' | 'POS_OPERATOR';

type TerminalAuthScreenGlobalProps = {
  authMode: 'GLOBAL';
  isOpen: boolean;
  cancellable?: boolean;
  onAuthenticated: (desktopMode: string) => void;
  onCancel?: () => void;
  outletId?: string;
};

type TerminalAuthScreenPosProps = {
  authMode: 'POS_OPERATOR';
  isOpen: boolean;
  cancellable?: boolean;
  onAuthenticated: (operator: StaffProfile, token: string, authData?: any) => void;
  onCancel?: () => void;
  outletId?: string;
};

type TerminalAuthScreenProps = TerminalAuthScreenGlobalProps | TerminalAuthScreenPosProps;

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function TerminalAuthScreen(props: TerminalAuthScreenProps) {
  if (!props.isOpen) return null;

  if (props.authMode === 'GLOBAL') {
    return <GlobalAuthShell {...props} />;
  }
  return <PosOperatorAuthShell {...props} />;
}

// ─────────────────────────────────────────────────────────────
// GLOBAL Shell — wires useGlobalTerminalAuth to shared UI
// ─────────────────────────────────────────────────────────────

function GlobalAuthShell(props: TerminalAuthScreenGlobalProps) {
  const { isOnline } = useLodgeCoreProvider();
  const { provider, isDesktopMode } = useLodgeCoreProvider();

  const auth = useGlobalTerminalAuth({
    isOpen: props.isOpen,
    onAuthenticated: props.onAuthenticated,
  });

  const title =
    auth.step === 'select' ? 'Select Operator' :
    auth.step === 'pin'    ? `Enter PIN — ${auth.selectedStaff?.firstName}` :
    'Signing in…';

  return (
    <OverlayWrapper>
      <DialogCard>
        <DialogHeader
          title={title}
          showBack={auth.step === 'pin'}
          onBack={auth.goBack}
          showClose={!!props.cancellable}
          onClose={props.onCancel}
          badge={isDesktopMode ? (isOnline ? 'online' : 'offline') : undefined}
        />

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Left — Staff Grid */}
          <div className="flex-1 p-5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <StaffGrid
              staff={auth.staff}
              staffLoading={auth.staffLoading}
              selectedStaffId={auth.selectedStaff?.id}
              onSelect={auth.selectStaff}
              onReload={async () => {
                if (provider.system?.forceSync) {
                  toast.promise(
                    provider.system.forceSync().then(() => auth.reloadStaff()),
                    {
                      loading: 'Synchronizing with cloud…',
                      success: 'Sync complete',
                      error: 'Sync failed. Check connection.',
                    }
                  );
                } else {
                  await auth.reloadStaff();
                }
              }}
              showReload={isDesktopMode && !!provider.system?.forceSync}
            />
          </div>

          {/* Right — PIN pad */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col justify-center p-6">
            <PinPanel
              pin={auth.pin}
              error={auth.error}
              isLoading={auth.isLoading}
              disabled={!auth.selectedStaff}
              onKey={auth.pressKey}
              onBackspace={auth.pressBackspace}
            />
          </div>
        </div>
      </DialogCard>
    </OverlayWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// POS_OPERATOR Shell — wires usePosOperatorAuth to shared UI
// ─────────────────────────────────────────────────────────────

function PosOperatorAuthShell(props: TerminalAuthScreenPosProps) {
  const { isOnline } = useLodgeCoreProvider();
  const { provider, isDesktopMode } = useLodgeCoreProvider();

  const auth = usePosOperatorAuth({
    isOpen: props.isOpen,
    outletId: props.outletId,
    onAuthenticated: props.onAuthenticated,
  });

  const title =
    auth.step === 'select'        ? 'Who is working today?' :
    auth.step === 'pin'           ? `Enter PIN — ${auth.selectedStaff?.firstName}` :
    auth.step === 'shift'         ? 'Open Your Shift' :
    auth.step === 'error_central' ? 'Central Till Closed' :
    '';

  const showBack =
    auth.step === 'pin' ||
    auth.step === 'shift' ||
    auth.step === 'error_central';

  return (
    <OverlayWrapper>
      <DialogCard compact>
        <DialogHeader
          title={title}
          showBack={showBack}
          onBack={auth.goBack}
          showClose={!!props.cancellable}
          onClose={props.onCancel}
          badge={isDesktopMode ? (isOnline ? 'online' : 'offline') : undefined}
        />

        {auth.step === 'select' && (
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
            <StaffGrid
              staff={auth.staff}
              staffLoading={auth.staffLoading}
              selectedStaffId={auth.selectedStaff?.id}
              onSelect={auth.selectStaff}
              onReload={auth.reloadStaff}
              showReload={isDesktopMode && !!provider.system?.forceSync}
              compact
            />
          </div>
        )}

        {auth.step === 'pin' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Operator badge sidebar */}
            <div className="w-32 shrink-0 bg-indigo-600 flex flex-col items-center justify-center gap-3 p-4">
              <div className="w-14 h-14 rounded-full bg-white/20 text-white font-black text-xl flex items-center justify-center shadow-inner ring-2 ring-white/30">
                {getInitials(auth.selectedStaff)}
              </div>
              <div className="text-center">
                <p className="text-white font-black text-sm leading-tight">{auth.selectedStaff?.firstName}</p>
                <p className="text-indigo-200 text-[10px] font-medium">
                  {auth.selectedStaff?.role || auth.selectedStaff?.position || 'Staff'}
                </p>
              </div>
            </div>

            {/* PIN pad */}
            <div className="flex-1 flex flex-col justify-center p-5">
              <PinPanel
                pin={auth.pin}
                error={auth.error}
                isLoading={auth.isLoading}
                disabled={false}
                onKey={auth.pressKey}
                onBackspace={auth.pressBackspace}
              />
            </div>
          </div>
        )}

        {auth.step === 'shift' && (
          <ShiftPanel
            operator={auth.verifiedOperator}
            openingFloat={auth.openingFloat}
            onFloatChange={auth.setOpeningFloat}
            error={auth.error}
            isLoading={auth.isLoading}
            onConfirm={auth.confirmStartShift}
          />
        )}

        {auth.step === 'error_central' && (
          <CentralCashierError
            onBack={auth.goBack}
          />
        )}
      </DialogCard>
    </OverlayWrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared UI Primitives
// ─────────────────────────────────────────────────────────────

function OverlayWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      {children}
    </div>
  );
}

function DialogCard({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div
      className="w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
      style={{ maxWidth: compact ? 520 : 860, maxHeight: '90vh' }}
    >
      {children}
    </div>
  );
}

function DialogHeader({
  title,
  showBack,
  onBack,
  showClose,
  onClose,
  badge,
}: {
  title: string;
  showBack: boolean;
  onBack?: () => void;
  showClose: boolean;
  onClose?: () => void;
  badge?: 'online' | 'offline';
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50 shrink-0">
      <div className="flex items-center gap-2.5">
        {showBack && (
          <button
            onClick={onBack}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        )}
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">
            LodgeCore POS
          </p>
          <h2 className="text-sm font-black text-slate-800 leading-tight">{title}</h2>
        </div>
        {badge && (
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              badge === 'online'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {badge === 'online' ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            {badge === 'online' ? 'Online' : 'Offline'}
          </div>
        )}
      </div>
      {showClose && (
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors touch-manipulation"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Staff Grid ───────────────────────────────────────────────

function StaffGrid({
  staff,
  staffLoading,
  selectedStaffId,
  onSelect,
  onReload,
  showReload,
  compact,
}: {
  staff: StaffProfile[];
  staffLoading: boolean;
  selectedStaffId?: string;
  onSelect: (s: StaffProfile) => void;
  onReload: () => Promise<void>;
  showReload: boolean;
  compact?: boolean;
}) {
  if (staffLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-medium">Loading staff profiles…</span>
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-4 gap-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
          <Lock className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-sm">No Profiles Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Staff profiles need to sync before you can sign in.
          </p>
        </div>
        {showReload && (
          <button
            onClick={onReload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors touch-manipulation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Now
          </button>
        )}
      </div>
    );
  }

  const cols = compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-3';

  return (
    <div className={`grid ${cols} gap-2.5`}>
      {staff.map((s) => {
        const initials = getInitials(s);
        const isSelected = selectedStaffId === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className={`group flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all duration-150 touch-manipulation active:scale-95 ${
              isSelected
                ? 'border-indigo-400 bg-indigo-50 shadow-md shadow-indigo-100'
                : 'border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-sm shadow transition-all ${
                isSelected
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20'
                  : 'bg-gradient-to-br from-indigo-400 to-indigo-600 text-white'
              }`}
            >
              {initials || '?'}
            </div>
            <div className="text-center min-w-0 w-full">
              <p className="font-bold text-slate-800 text-[11px] leading-tight truncate">
                {s.firstName}
              </p>
              <p className="text-[9px] text-slate-400 font-medium truncate">
                {s.role || s.position || 'Staff'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── PIN Panel ────────────────────────────────────────────────

function PinPanel({
  pin,
  error,
  isLoading,
  disabled,
  onKey,
  onBackspace,
}: {
  pin: string;
  error: string | null;
  isLoading: boolean;
  disabled: boolean;
  onKey: (k: string) => void;
  onBackspace: () => void;
}) {
  // Physical keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (disabled || isLoading) return;
      if (/^[0-9]$/.test(e.key)) onKey(e.key);
      if (e.key === 'Backspace') onBackspace();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disabled, isLoading, onKey, onBackspace]);

  return (
    <div className="flex flex-col gap-4">
      {/* PIN dots */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          {disabled ? 'Select a profile first' : 'Enter 4-digit PIN'}
        </p>
        <div className="flex gap-3" role="status" aria-label={`${pin.length} digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                i < pin.length
                  ? 'bg-indigo-600 scale-125 shadow-md shadow-indigo-200'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-bold bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg animate-in shake">
            {error}
          </div>
        )}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <NumKey
            key={n}
            label={String(n)}
            onClick={() => onKey(String(n))}
            disabled={disabled || isLoading}
          />
        ))}
        <div /> {/* spacer */}
        <NumKey label="0" onClick={() => onKey('0')} disabled={disabled || isLoading} />
        <button
          onClick={onBackspace}
          disabled={disabled || isLoading || pin.length === 0}
          className="h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 active:scale-95 disabled:opacity-30 transition-all touch-manipulation"
          aria-label="Delete"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          ) : (
            <X className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function NumKey({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-12 rounded-xl bg-slate-100 text-lg font-bold text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 disabled:opacity-30 transition-all touch-manipulation select-none"
    >
      {label}
    </button>
  );
}

// ─── Shift Opening Panel ──────────────────────────────────────

function ShiftPanel({
  operator,
  openingFloat,
  onFloatChange,
  error,
  isLoading,
  onConfirm,
}: {
  operator: StaffProfile | null;
  openingFloat: string;
  onFloatChange: (v: string) => void;
  error: string | null;
  isLoading: boolean;
  onConfirm: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-5 flex-1">
      {/* Verified identity badge */}
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <Check className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm leading-tight">
            {operator?.firstName} {operator?.lastName}
          </p>
          <p className="text-[11px] text-slate-500">
            {operator?.role || operator?.position} · Identity verified
          </p>
        </div>
      </div>

      {/* Float input */}
      <div className="flex-1">
        <label className="block text-sm font-bold text-slate-700 mb-1">Opening Float</label>
        <p className="text-xs text-slate-400 mb-2.5">
          Count cash in your drawer. Set to 0 if starting empty.
        </p>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
            ₦
          </span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="100"
            value={openingFloat}
            onChange={(e) => onFloatChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
            className="w-full pl-8 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-lg font-black text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
          />
        </div>
        {error && (
          <div className="mt-2.5 flex items-center gap-1.5 text-rose-600 text-[11px] font-bold bg-rose-50 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={onConfirm}
        disabled={isLoading}
        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 touch-manipulation"
      >
        {isLoading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Opening shift…</>
        ) : (
          <><Banknote className="w-4 h-4" /> Open Shift &amp; Enter POS</>
        )}
      </button>
    </div>
  );
}

// ─── Central Cashier Error Panel ──────────────────────────────

function CentralCashierError({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center gap-4 flex-1">
      <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
        <ShieldAlert className="w-7 h-7 text-rose-500" />
      </div>
      <div>
        <h3 className="text-base font-black text-slate-800">Central Till is Closed</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">
          A manager must open the main till before you can proceed. Contact your supervisor.
        </p>
      </div>
      <button
        onClick={onBack}
        className="px-5 py-2 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors touch-manipulation"
      >
        Back to Staff List
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getInitials(staff: StaffProfile | null): string {
  if (!staff) return '';
  return `${staff.firstName?.[0] || ''}${staff.lastName?.[0] || ''}`.toUpperCase();
}
