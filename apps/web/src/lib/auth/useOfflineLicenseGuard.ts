'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { readOfflineLicenseSnapshot, type OfflineLicenseSnapshot } from './offline-navigation-snapshot';

type GuardState = {
  isExpired: boolean;
  isRevoked: boolean;
  restrictedMode: boolean;
  expiresAt: string | null;
};

function evaluate(snapshot: OfflineLicenseSnapshot | null, terminal: any): GuardState {
  const registrationState = String(terminal?.registrationState ?? '').toUpperCase();
  const licenseState = String(terminal?.licenseState ?? '').toUpperCase();
  const revokedAt = terminal?.revokedAt ?? null;
  const hasLocalTerminal = Boolean(terminal && registrationState);
  const expiresAt = hasLocalTerminal
    ? (terminal?.licenseExpiresAt ?? null)
    : (snapshot?.expiresAt ?? null);

  // An unprovisioned terminal is handled by the desktop setup flow. It must
  // not be mistaken for an expired subscription.
  if (registrationState === 'UNREGISTERED' || registrationState === 'UNKNOWN') {
    return { isExpired: false, isRevoked: false, restrictedMode: false, expiresAt };
  }

  const isRevoked = Boolean(revokedAt)
    || licenseState === 'REVOKED'
    || registrationState === 'REVOKED'
    || snapshot?.status === 'REVOKED';
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
  const isExpired = licenseState === 'EXPIRED' || snapshot?.status === 'EXPIRED'
    || (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now());
  const restrictedMode = isRevoked || isExpired || licenseState === 'RESTRICTED';

  return { isExpired, isRevoked, restrictedMode, expiresAt };
}

export function useOfflineLicenseGuard(propertyId?: string | null): GuardState {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [snapshot, setSnapshot] = useState<OfflineLicenseSnapshot | null>(null);
  const [terminal, setTerminal] = useState<any>(null);
  const desktop = process.env.NEXT_PUBLIC_IS_DESKTOP === 'true' || isDesktopMode;

  useEffect(() => {
    if (!desktop) return;
    setSnapshot(readOfflineLicenseSnapshot(propertyId));
    let cancelled = false;
    const request = provider.system?.getTerminalStatus?.();
    if (request) {
      void request.then((value) => {
        if (!cancelled) setTerminal(value);
      }).catch(() => {
        // The cached/local snapshot remains authoritative offline.
      });
    }
    return () => { cancelled = true; };
  }, [desktop, propertyId, provider]);

  return useMemo(
    () => desktop ? evaluate(snapshot, terminal) : {
      isExpired: false,
      isRevoked: false,
      restrictedMode: false,
      expiresAt: null,
    },
    [desktop, snapshot, terminal],
  );
}
