'use client';

import { useState, useEffect } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import type { StaffProfile } from './useGlobalTerminalAuth';

export type PosOperatorStep =
  | 'select'       // staff grid
  | 'pin'          // PIN entry
  | 'shift'        // opening float (SERVER_BANKING only)
  | 'error_central'; // central cashier model — till not open

export interface UsePosOperatorAuthResult {
  // Data
  staff: StaffProfile[];
  staffLoading: boolean;
  selectedStaff: StaffProfile | null;
  pin: string;
  step: PosOperatorStep;
  error: string | null;
  isLoading: boolean;
  openingFloat: string;
  verifiedOperator: StaffProfile | null;

  // Actions
  selectStaff: (s: StaffProfile) => void;
  pressKey: (key: string) => void;
  pressBackspace: () => void;
  goBack: () => void;
  setOpeningFloat: (value: string) => void;
  confirmStartShift: () => Promise<void>;
  reloadStaff: () => Promise<void>;
}

/**
 * Manages POS OPERATOR authentication.
 *
 * This calls provider.pos.authenticateOperator() to authenticate a specific
 * operator within an *already-established* terminal session. It manages POS
 * sessions, operator tokens, and shift banking — completely independently of
 * the global terminal session.
 *
 * The global session (established at /desktop) is NEVER touched here.
 * operator token and POS session ID are stored in localStorage only.
 */
export function usePosOperatorAuth({
  isOpen,
  outletId,
  onAuthenticated,
}: {
  isOpen: boolean;
  outletId?: string;
  onAuthenticated: (operator: StaffProfile, token: string, authData?: any) => void;
}): UsePosOperatorAuthResult {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';

  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<PosOperatorStep>('select');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('0');
  const [verifiedOperator, setVerifiedOperator] = useState<StaffProfile | null>(null);
  const [pendingToken, setPendingToken] = useState<string>('');

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      let res: any;
      if (isDesktopMode) {
        res = await provider.auth.getActiveStaff();
      } else if (propertyId) {
        res = await provider.pos.getActiveStaff(propertyId);
      }
      if (res?.data) setStaff(res.data);
    } catch (e) {
      console.error('[PosOperatorAuth] Failed to load staff', e);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    // Reset state every time the auth screen opens (lock or switch)
    setSelectedStaff(null);
    setPin('');
    setStep('select');
    setError(null);
    setOpeningFloat('0');
    setVerifiedOperator(null);
    setPendingToken('');
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selectStaff = (s: StaffProfile) => {
    setSelectedStaff(s);
    setPin('');
    setError(null);
    setStep('pin');
  };

  const goBack = () => {
    setError(null);
    setPin('');
    if (step === 'pin') {
      setStep('select');
    } else if (step === 'shift' || step === 'error_central') {
      setStep('pin');
    }
  };

  const resolveOutletId = () =>
    outletId ||
    (session as any)?.outletId ||
    localStorage.getItem('lodgecore_pos_outlet_id') ||
    '';

  const resolveDeviceId = () =>
    (session as any)?.deviceId ||
    localStorage.getItem('lodgecore_pos_device_id') ||
    '';

  const submitPin = async (pinValue: string) => {
    if (!selectedStaff) return;
    setIsLoading(true);
    setError(null);

    try {
      const existingSessionId =
        localStorage.getItem('lodgecore_pos_session_id') ||
        (session as any)?.sessionId ||
        '';
      const finalOutletId = resolveOutletId();
      const deviceId = resolveDeviceId();

      const res = await provider.pos.authenticateOperator(
        selectedStaff.id,
        pinValue,
        propertyId,
        existingSessionId,
        finalOutletId,
        deviceId,
      );

      if (res.error || !res.data) {
        setError(res.error || 'Incorrect PIN. Please try again.');
        setPin('');
        return;
      }

      const auth = res.data;
      const token: string = auth.operatorToken || '';
      const operator: StaffProfile = auth.staff || selectedStaff;

      // Central cashier model — the central till hasn't been opened yet
      if (auth.requiresBank) {
        localStorage.removeItem('lodgecore_pos_session_id');
        if (token) localStorage.setItem('lodgecore_pos_operator_token', token);
        onAuthenticated(operator, token, auth);
        return;
      }

      // Existing POS session — go straight in, no float needed
      if (auth.posSessionId || auth.sessionId) {
        const sessionId = auth.posSessionId || auth.sessionId;
        localStorage.setItem('lodgecore_pos_session_id', sessionId);
        if (token) localStorage.setItem('lodgecore_pos_operator_token', token);
        onAuthenticated(operator, token, auth);
        return;
      }

      // Server banking model with no active session — must open shift
      if (auth.bankingModel === 'SERVER_BANKING') {
        localStorage.removeItem('lodgecore_pos_session_id');
        setVerifiedOperator(operator);
        setPendingToken(token);
        setStep('shift');
        return;
      }

      // All other models — directly in
      if (!auth.posSessionId && !auth.sessionId) {
        localStorage.removeItem('lodgecore_pos_session_id');
      }
      if (token) localStorage.setItem('lodgecore_pos_operator_token', token);
      onAuthenticated(operator, token, auth);
    } catch (e: any) {
      setError(e.message || 'Authentication failed. Check your connection.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const pressKey = (key: string) => {
    if (isLoading || step !== 'pin') return;
    const next = pin + key;
    if (next.length > 4) return;
    setPin(next);
    setError(null);
    if (next.length === 4) submitPin(next);
  };

  const pressBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  const confirmStartShift = async () => {
    if (!verifiedOperator || !pendingToken) return;
    setIsLoading(true);
    setError(null);

    try {
      const finalOutletId = resolveOutletId();
      const deviceId = resolveDeviceId();
      const openingCash = parseFloat(openingFloat) || 0;

      if (isDesktopMode) {
        const res = await provider.pos.startSession({
          userId: verifiedOperator.id,
          propertyId,
          deviceId,
          outletId: finalOutletId,
          openingCash,
        });

        if (res?.data?.sessionId) {
          localStorage.setItem('lodgecore_pos_session_id', res.data.sessionId);
          localStorage.setItem('lodgecore_pos_operator_token', pendingToken);
          onAuthenticated(verifiedOperator, pendingToken, { bankingModel: 'SERVER_BANKING', sessionId: res.data.sessionId });
        } else {
          setError(res?.error || 'Failed to open shift. Try again.');
        }
      } else {
        const res = await fetch('/api/v1/pos/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${pendingToken}`,
          },
          body: JSON.stringify({
            propertyId,
            deviceId,
            outletId: finalOutletId,
            openingCash,
          }),
        });
        const data = await res.json();

        if (res.ok && data.data?.sessionId) {
          localStorage.setItem('lodgecore_pos_session_id', data.data.sessionId);
          localStorage.setItem('lodgecore_pos_operator_token', pendingToken);
          onAuthenticated(verifiedOperator, pendingToken, { bankingModel: 'SERVER_BANKING', sessionId: data.data.sessionId });
        } else {
          setError(data.error || 'Failed to open shift. Try again.');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to open shift.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    staff,
    staffLoading,
    selectedStaff,
    pin,
    step,
    error,
    isLoading,
    openingFloat,
    verifiedOperator,
    selectStaff,
    pressKey,
    pressBackspace,
    goBack,
    setOpeningFloat,
    confirmStartShift,
    reloadStaff: loadStaff,
  };
}
