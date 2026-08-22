'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Lock, Unlock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/hooks/useLogout';

interface LockContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: (pin: string) => boolean;
}

const LockContext = createContext<LockContextType | null>(null);

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const { data: session } = useSession();
  const logout = useLogout();

  // On mount, check if previously locked
  useEffect(() => {
    const lockedState = localStorage.getItem('lodgecore_is_locked');
    if (lockedState === 'true') {
      setIsLocked(true);
    }
  }, []);

  const lock = () => {
    setIsLocked(true);
    localStorage.setItem('lodgecore_is_locked', 'true');
  };

  const unlock = (pin: string) => {
    // In a real app, this would validate against a hashed PIN stored locally or via IPC
    // For now, any 4-digit PIN unlocks it
    if (pin.length >= 4) {
      setIsLocked(false);
      localStorage.removeItem('lodgecore_is_locked');
      return true;
    }
    return false;
  };

  const handleSignOut = async () => {
    localStorage.removeItem('lodgecore_is_locked');
    setIsLocked(false);
    logout();
  };

  return (
    <LockContext.Provider value={{ isLocked, lock, unlock }}>
      {children}
      
      {isLocked && session?.user && (
        <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-sm flex flex-col items-center relative overflow-hidden">
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
            
            <div className="h-16 w-16 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
              <Lock className="w-8 h-8 text-indigo-400" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">WORKSTATION LOCKED</h2>
            <p className="text-slate-400 mb-6 text-center text-sm font-medium">
              {session.user.name || session.user.email} • {(session.user as any).role?.replace('_', ' ')}
            </p>

            <LockScreenPinInput onUnlock={unlock} />

            <div className="mt-8 pt-6 border-t border-slate-700 w-full text-center">
              <Button 
                variant="ghost" 
                onClick={handleSignOut}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Not you? Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </LockContext.Provider>
  );
}

function LockScreenPinInput({ onUnlock }: { onUnlock: (pin: string) => boolean }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleNum = (num: string) => {
    setError(false);
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        // Try to unlock automatically when 4 digits are entered
        const success = onUnlock(newPin);
        if (!success) {
          setError(true);
          setPin('');
        }
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* PIN Dots */}
      <div className="flex gap-4 mb-8 h-4">
        {[0, 1, 2, 3].map(i => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              pin.length > i 
                ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] scale-110' 
                : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-rose-400 text-sm font-medium mb-4 animate-shake">Incorrect PIN</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            onClick={() => handleNum(num)}
            className="h-14 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xl transition-colors active:scale-95"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="h-14 rounded-xl text-slate-400 hover:text-white font-medium transition-colors active:scale-95"
        >
          CLEAR
        </button>
        <button
          onClick={() => handleNum('0')}
          className="h-14 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xl transition-colors active:scale-95"
        >
          0
        </button>
        <button
          disabled={pin.length < 4}
          onClick={() => onUnlock(pin)}
          className={`h-14 rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
            pin.length === 4 
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
              : 'bg-slate-800 text-slate-600'
          }`}
        >
          <Unlock className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
