'use client';

import React, { useEffect, useRef } from 'react';

interface AutoLockScreenProps {
  children: React.ReactNode;
  onLock: () => void;
  isLocked: boolean;
}

const AUTO_LOCK_MS = 30_000;

export function AutoLockScreen({ children, onLock, isLocked }: AutoLockScreenProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRef = useRef(onLock);

  useEffect(() => {
    lockRef.current = onLock;
  }, [onLock]);

  useEffect(() => {
    if (isLocked) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => lockRef.current(), AUTO_LOCK_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      'pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel',
    ];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [isLocked]);

  return <>{children}</>;
}
