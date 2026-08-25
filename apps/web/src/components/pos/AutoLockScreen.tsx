'use client';

import React from 'react';

interface AutoLockScreenProps {
  children: React.ReactNode;
  onLock: () => void;
  isLocked: boolean;
}

export function AutoLockScreen({ children }: AutoLockScreenProps) {
  return <>{children}</>;
}
