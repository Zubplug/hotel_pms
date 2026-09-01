import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, AlertCircle, X, ChevronLeft, Loader2, RefreshCw } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { PinPad } from './PinPad';

export type ManagerOverrideModalProps = {
  isOpen: boolean;
  actionName: string; // e.g., 'Void Item', 'Cash Drawer Open'
  onAuthorized: (managerId: string, managerPin: string, reason: string) => void;
  onCancel: () => void;
};

type ManagerProfile = {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  position?: string;
};

type Step = 'select' | 'reason' | 'pin';

export function ManagerOverrideModal({ isOpen, actionName, onAuthorized, onCancel }: ManagerOverrideModalProps) {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';

  const [step, setStep] = useState<Step>('select');
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ManagerProfile | null>(null);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const loadManagers = async () => {
    setLoading(true);
    try {
      let res: any;
      if (isDesktopMode) {
        res = await provider.auth.getActiveStaff('MANAGER,ADMIN');
      } else if (propertyId) {
        res = await provider.pos.getActiveStaff(propertyId);
      }
      if (res?.data) {
        const roles = new Set(['MANAGER', 'ADMIN']);
        const fetched = res.data.filter((member: ManagerProfile) => {
          const r = String(member.role || member.position || '').toUpperCase().replace(/[^A-Z]/g, '');
          return roles.has(r);
        });
        setManagers(fetched);
      }
    } catch (e) {
      console.error('Failed to load managers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedManager(null);
      setReason('');
      setPin('');
      setError('');
      loadManagers();
    }
  }, [isOpen]);

  const handleSelectManager = (mgr: ManagerProfile) => {
    setSelectedManager(mgr);
    setStep('reason');
    setError('');
  };

  const handleReasonNext = () => {
    if (reason.trim().length < 5) {
      setError('Please provide a descriptive reason (at least 5 characters).');
      return;
    }
    setError('');
    setStep('pin');
  };

  const handleNumPad = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError('');
      if (newPin.length === 4) {
        // Automatically submit when 4 digits are entered
        onAuthorized(selectedManager!.id, newPin, reason);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const goBack = () => {
    if (step === 'reason') setStep('select');
    if (step === 'pin') {
      setPin('');
      setStep('reason');
    }
    setError('');
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200" style={{ maxHeight: '90vh' }}>
        
        <div className="flex items-center justify-between mb-4 border-b pb-4">
          <div className="flex items-center gap-3">
            {step !== 'select' && (
              <button onClick={goBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">Manager Override</h2>
              <p className="text-xs font-semibold text-red-500">{actionName}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600">Select authorizing manager:</p>
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : managers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-500 mb-4">No managers found on this device.</p>
                  <button onClick={loadManagers} className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700 flex items-center gap-2 mx-auto hover:bg-slate-200">
                    <RefreshCw className="w-4 h-4" /> Try Again
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {managers.map(mgr => (
                    <button
                      key={mgr.id}
                      onClick={() => handleSelectManager(mgr)}
                      className="p-3 border border-slate-200 rounded-xl flex flex-col items-center text-center hover:bg-red-50 hover:border-red-200 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 font-bold text-lg flex items-center justify-center mb-2">
                        {mgr.firstName?.[0]}{mgr.lastName?.[0]}
                      </div>
                      <p className="text-sm font-bold text-slate-800">{mgr.firstName}</p>
                      <p className="text-xs text-slate-500">{mgr.role || 'Manager'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'reason' && (
            <div className="space-y-4 flex flex-col justify-center py-4">
              <p className="text-sm font-semibold text-slate-600">Why is this override required?</p>
              <textarea
                autoFocus
                className="w-full p-3 border border-slate-300 rounded-xl resize-none outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                placeholder="e.g. Guest complaint, wrong entry, system issue..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <button
                onClick={handleReasonNext}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'pin' && (
            <div className="flex flex-col items-center py-2">
              <p className="text-sm font-semibold text-slate-600 mb-1">Enter PIN for {selectedManager?.firstName}</p>
              <p className="text-xs text-slate-400 mb-6 text-center max-w-[250px]">
                By entering your PIN, you authorize this action and accept accountability in the audit log.
              </p>

              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3].map(i => (
                  <div 
                    key={i} 
                    className={`w-4 h-4 rounded-full transition-colors ${
                      i < pin.length ? 'bg-red-500 scale-110 shadow-sm' : 'bg-slate-200'
                    }`} 
                  />
                ))}
              </div>

              <div className="w-full max-w-[280px]">
                <PinPad pin={pin} onNumPad={handleNumPad} onDelete={handleDelete} disabled={false} />
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>,
    document.body
  );
}
