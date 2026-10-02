import { useEffect, useState } from 'react';

interface LicenseGuardOptions {
  sessionContext: any;
  terminalStatus?: any;
}

interface LicenseGuardResult {
  isExpired: boolean;
  isRevoked: boolean;
  restrictedMode: boolean;
}

function checkLicense(sessionContext: any, terminalStatus?: any): LicenseGuardResult {
  const terminal = { ...(sessionContext?.terminal || {}), ...(terminalStatus || {}) };
  const registrationState = String(terminal?.registrationState || '').toUpperCase();

  const isRevoked = Boolean(terminal?.isRevoked)
    || registrationState === 'REVOKED';

  let isExpired = false;
  if (terminal?.licenseExpiresAt) {
    const expiresAt = new Date(terminal.licenseExpiresAt).getTime();
    if (!isNaN(expiresAt) && expiresAt < Date.now()) {
      isExpired = true;
    }
  }

  return {
    isExpired,
    isRevoked,
    restrictedMode: isExpired || isRevoked,
  };
}

export function useLicenseGuard({
  sessionContext,
  terminalStatus,
}: LicenseGuardOptions): LicenseGuardResult {
  const [result, setResult] = useState<LicenseGuardResult>(() =>
    checkLicense(sessionContext, terminalStatus)
  );

  useEffect(() => {
    // Re-evaluate immediately whenever sessionContext changes
    setResult(checkLicense(sessionContext, terminalStatus));

    // Then re-check every 60 seconds (catches expiry crossing the threshold)
    const intervalId = setInterval(() => {
      setResult(checkLicense(sessionContext, terminalStatus));
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [sessionContext, terminalStatus]);

  return result;
}
