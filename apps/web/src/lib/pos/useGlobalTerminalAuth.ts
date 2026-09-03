'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

export type GlobalAuthStep = 'select' | 'pin' | 'success' | 'error';
export type GlobalAuthError = string | null;

export interface StaffProfile {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  position?: string;
}

export interface UseGlobalTerminalAuthResult {
  // Data
  staff: StaffProfile[];
  staffLoading: boolean;
  selectedStaff: StaffProfile | null;
  pin: string;
  step: GlobalAuthStep;
  error: GlobalAuthError;
  isLoading: boolean;

  // Actions
  selectStaff: (s: StaffProfile) => void;
  pressKey: (key: string) => void;
  pressBackspace: () => void;
  goBack: () => void;
  reloadStaff: () => Promise<void>;
}

/**
 * Manages GLOBAL terminal authentication.
 *
 * This calls provider.auth.login() to establish the master/global session for
 * the terminal. It does NOT touch POS sessions, operator tokens, or shift state.
 *
 * On success, it calls onAuthenticated(desktopMode) where desktopMode is
 * 'FRONT_DESK' | 'POS' — the caller is responsible for routing.
 */
export function useGlobalTerminalAuth({
  isOpen,
  onAuthenticated,
  allowedRoles,
}: {
  isOpen: boolean;
  onAuthenticated: (desktopMode: string) => void;
  allowedRoles?: string[];
}): UseGlobalTerminalAuthResult {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const queryClient = useQueryClient();
  const propertyId = (session?.user as any)?.propertyId || '';

  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<GlobalAuthStep>('select');
  const [error, setError] = useState<GlobalAuthError>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      let res: any;
      if (isDesktopMode) {
        res = await provider.auth.getActiveStaff(allowedRoles?.join(',') || undefined);
      } else if (propertyId) {
        res = await provider.pos.getActiveStaff(propertyId);
      }
      if (res?.data) {
        const roles = new Set((allowedRoles || []).map(role => role.toUpperCase()));
        setStaff(roles.size === 0 ? res.data : res.data.filter((member: StaffProfile) => roles.has(String(member.role || member.position || '').toUpperCase())));
      }
    } catch (e) {
      console.error('[GlobalAuth] Failed to load staff', e);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    // Reset on open
    setSelectedStaff(null);
    setPin('');
    setStep('select');
    setError(null);
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
    if (step === 'pin') {
      setStep('select');
      setPin('');
      setError(null);
    }
  };

  const submitPin = async (pinValue: string) => {
    if (!selectedStaff) return;
    setIsLoading(true);
    setError(null);

    try {
      if (isDesktopMode) {
        // Desktop: authenticate against the local SQLite / C# auth layer
        const authRes = await provider.auth.login(selectedStaff.id, pinValue);

        if (!authRes.error && authRes.success) {
          // A receptionist may have opened a Front Desk till before the terminal
          // was locked or disconnected. Push that session and refresh its UI
          // queries as soon as the operator is authenticated again.
          if (selectedStaff.role?.toUpperCase() === 'RECEPTIONIST' || selectedStaff.role?.toUpperCase() === 'FRONT_DESK') {
            try {
              await provider.system?.forceSync?.();
            } catch {
              // Login remains available offline; the outbox will retry later.
            }
            await queryClient.invalidateQueries({ queryKey: ['frontdesk'] });
            await queryClient.invalidateQueries({ queryKey: ['frontdesk-session'] });
          }
          // Read back the terminal configuration to decide routing
          const statusRes = await provider.system?.getTerminalStatus?.();
          const mode = statusRes?.desktopMode || 'UNKNOWN';
          await queryClient.invalidateQueries({ queryKey: ['desktop_auth'] });
          await queryClient.refetchQueries({ queryKey: ['desktop_auth'] });
          setStep('success');
          onAuthenticated(mode);
        } else {
          setError(authRes.error || 'Incorrect PIN. Please try again.');
          setPin('');
        }
      } else {
        // Web preview: use POS operator auth directly when not running in the desktop client
        const sessionId = localStorage.getItem('lodgecore_pos_session_id') || '';
        const deviceId = localStorage.getItem('lodgecore_pos_device_id') || '';
        const res = await provider.pos.authenticateOperator(
          selectedStaff.id,
          pinValue,
          propertyId,
          sessionId,
          '',
          deviceId,
        );

        if (!res.error && res.data?.success) {
          setStep('success');
          onAuthenticated('POS');
        } else {
          setError(res.error || res.data?.error || 'Incorrect PIN. Please try again.');
          setPin('');
        }
      }
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

  return {
    staff,
    staffLoading,
    selectedStaff,
    pin,
    step,
    error,
    isLoading,
    selectStaff,
    pressKey,
    pressBackspace,
    goBack,
    reloadStaff: loadStaff,
  };
}
