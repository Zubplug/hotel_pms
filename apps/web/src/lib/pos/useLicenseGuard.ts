import { useEffect, useState } from 'react';

interface LicenseGuardOptions {
  sessionContext: any;
}

interface LicenseGuardResult {
  isExpired: boolean;
  isRevoked: boolean;
  restrictedMode: boolean;
}

function checkLicense(sessionContext: any): LicenseGuardResult {
  const terminal = sessionContext?.terminal;

  const isRevoked = Boolean(terminal?.isRevoked);

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
}: LicenseGuardOptions): LicenseGuardResult {
  const [result, setResult] = useState<LicenseGuardResult>(() =>
    checkLicense(sessionContext)
  );

  useEffect(() => {
    // Re-evaluate immediately whenever sessionContext changes
    setResult(checkLicense(sessionContext));

    // Then re-check every 60 seconds (catches expiry crossing the threshold)
    const intervalId = setInterval(() => {
      setResult(checkLicense(sessionContext));
    }, 60_000);

    return () => clearInterval(intervalId);
  }, [sessionContext]);

  return result;
}
