'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { OperatorSelectionScreen } from './OperatorSelectionScreen';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

export function AutoLockScreen({ children }: { children: React.ReactNode }) {
  const { data: session } = useLodgeCoreSession();
  const [isLocked, setIsLocked] = useState(false);
  
  // Default to 60 seconds for restaurant, can be read from session/outlet config
  const autoLockSeconds = (session as any)?.autoLockSeconds || 60;

  const resetTimer = useCallback(() => {
    if (!isLocked) {
      // Logic to reset timer. We'll use a simple timeout here.
    }
  }, [isLocked]);

  useEffect(() => {
    if (isLocked) return;

    let timeout: NodeJS.Timeout;
    
    const lock = () => {
      setIsLocked(true);
    };

    const reset = () => {
      clearTimeout(timeout);
      timeout = setTimeout(lock, autoLockSeconds * 1000);
    };

    // Initial set
    reset();

    // Listeners for user activity
    window.addEventListener('mousemove', reset);
    window.addEventListener('mousedown', reset);
    window.addEventListener('keypress', reset);
    window.addEventListener('touchstart', reset);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('mousedown', reset);
      window.removeEventListener('keypress', reset);
      window.removeEventListener('touchstart', reset);
    };
  }, [isLocked, autoLockSeconds]);

  const handleAuthenticated = () => {
    setIsLocked(false);
  };

  return (
    <>
      {children}
      {isLocked && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xl">
          <OperatorSelectionScreen 
            isOpen={true} 
            cancellable={false} 
            onAuthenticated={handleAuthenticated} 
          />
        </div>
      )}
    </>
  );
}
