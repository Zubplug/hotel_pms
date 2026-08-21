'use client';

import { useState, useEffect } from 'react';
import { User, AlertCircle, X, Banknote, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { PinPad } from './PinPad';

type OperatorSelectionScreenProps = {
  isOpen: boolean;
  onAuthenticated: (operator: any, token?: string) => void;
  onCancel?: () => void;
  cancellable?: boolean;
  outletId?: string;
};

export function OperatorSelectionScreen({ isOpen, onAuthenticated, onCancel, cancellable = false, outletId }: OperatorSelectionScreenProps) {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';

  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [bankState, setBankState] = useState<'NONE' | 'NEEDS_SERVER_BANK' | 'CENTRAL_CASHIER_UNAVAILABLE'>('NONE');
  const [openingFloat, setOpeningFloat] = useState<string>('0');
  const [authData, setAuthData] = useState<{ operator: any, token: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (isDesktopMode) {
      provider.auth.getActiveStaff().then(res => {
        if (res?.error) {
          console.error("Desktop getActiveStaff returned error:", res.error);
        }
        if (res?.data) {
          console.log("Desktop getActiveStaff loaded successfully:", res.data.length, "profiles");
          setStaff(res.data);
        } else if (!res?.data && !res?.error) {
          console.warn("Desktop getActiveStaff returned unexpected format:", res);
        }
      }).catch(err => {
        console.error("Desktop getActiveStaff threw exception:", err);
      });
    } else if (propertyId) {
      provider.pos.getActiveStaff(propertyId).then(res => {
        if (res?.error) {
          console.error("POS getActiveStaff returned error:", res.error);
        }
        if (res?.data) {
          console.log("POS getActiveStaff loaded successfully:", res.data.length, "profiles");
          setStaff(res.data);
        } else if (!res?.data && !res?.error) {
          console.warn("POS getActiveStaff returned unexpected format:", res);
        }
      }).catch(err => {
        console.error("POS getActiveStaff threw exception:", err);
      });
    }
  }, [isOpen, propertyId, provider, isDesktopMode]);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setSelectedStaff(null);
      setBankState('NONE');
      setAuthData(null);
    }
  }, [isOpen]);

  const handleNumPad = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleProcessLoginSuccess = async (authRes: any, staffObj: any, token: string) => {
    if (authRes.requiresBank) {
      setBankState('CENTRAL_CASHIER_UNAVAILABLE');
    } else {
      if (authRes.posSessionId || authRes.sessionId) {
        localStorage.setItem('lodgecore_pos_session_id', authRes.posSessionId || authRes.sessionId);
      }
      onAuthenticated(staffObj, token);
    }
  };

  const handleLogin = async () => {
    if (!selectedStaff || pin.length < 4) return;
    setIsLoading(true);
    setError('');

    try {
      if (isDesktopMode) {
        const authRes = await provider.auth.login(selectedStaff.id, pin);

        if (!authRes.error && authRes.success) {
          const sessionResStr = await provider.auth.getSession();
          const sessionRes = typeof sessionResStr === 'string' ? JSON.parse(sessionResStr) : sessionResStr;
          const userObj = (sessionRes.success && sessionRes.data?.user) ? sessionRes.data.user : selectedStaff;
          
          await handleProcessLoginSuccess(authRes, userObj, "desktop_token");
        } else {
          setError(authRes.error || 'Authentication failed');
          setPin('');
        }
      } else {
        const sessionId = localStorage.getItem('lodgecore_pos_session_id') || '';
        const deviceId = localStorage.getItem('lodgecore_pos_device_id') || '';
        const authRes = await provider.pos.authenticateOperator(selectedStaff.id, pin, propertyId, sessionId, outletId || '', deviceId);
        
        if (!authRes.error && authRes.data?.success) {
           await handleProcessLoginSuccess(authRes.data, authRes.data.staff, authRes.data.operatorToken);
        } else {
           setError(authRes.error || 'Authentication failed');
           setPin('');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Authentication failed');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      handleLogin();
    }
  }, [pin]);

  const handleStartShift = async () => {
    if (!authData) return;
    setIsLoading(true);
    setError('');

    try {
      const deviceId = localStorage.getItem('lodgecore_pos_device_id') || '';
      
      const req = {
        propertyId,
        deviceId,
        outletId: outletId || localStorage.getItem('lodgecore_pos_outlet_id') || '',
        openingCash: parseFloat(openingFloat) || 0
      };

      if (isDesktopMode) {
        // Desktop handles it locally or via IPC
        // In desktop mode we assume the backend handles it or we call a new provider method
        // For now, onAuthenticated directly since we don't have a desktop startSession implemented yet
        // Wait, desktop session is started via API when online? 
        // We can just call the /api/v1/pos/sessions directly or rely on the web app for this phase
        onAuthenticated(authData.operator, authData.token);
      } else {
        const res = await fetch('/api/v1/pos/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.token}`
          },
          body: JSON.stringify(req)
        });

        const data = await res.json();
        if (res.ok && data.data?.sessionId) {
          localStorage.setItem('lodgecore_pos_session_id', data.data.sessionId);
          onAuthenticated(authData.operator, authData.token);
        } else {
          setError(data.error || 'Failed to start shift');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start shift');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
        
        {/* Left Side - Staff Selection */}
        <div className="flex-1 bg-slate-50 p-10 border-r border-slate-200 h-[640px] overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Select Operator</h2>
              <p className="text-slate-500 mt-1">Tap your profile to sign in</p>
            </div>
            {cancellable && (
              <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-700 w-12 h-12 rounded-full hover:bg-slate-200">
                <X className="w-6 h-6" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {staff.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedStaff(s);
                  setPin('');
                  setBankState('NONE');
                }}
                className={`flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all ${
                  selectedStaff?.id === s.id 
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-4 ring-indigo-600/10' 
                    : 'border-transparent bg-white hover:border-slate-300 shadow-sm hover:shadow-md'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                  selectedStaff?.id === s.id ? 'bg-indigo-600 text-white shadow-inner' : 'bg-slate-100 text-slate-400'
                }`}>
                  <User className="w-8 h-8" />
                </div>
                <span className="font-semibold text-lg text-slate-800 tracking-tight">{s.firstName} {s.lastName}</span>
                <span className="text-sm font-medium text-slate-500 mt-1">{s.role || s.position}</span>
              </button>
            ))}
            
            {staff.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-12">
                Loading staff profiles...
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Dynamic */}
        <div className="w-full md:w-[420px] p-10 flex flex-col h-[640px] bg-white">
          
          {bankState === 'NONE' && (
            <>
              <div className="text-center mb-10">
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  {selectedStaff ? `Enter PIN for ${selectedStaff.firstName}` : 'Select a profile first'}
                </h3>
                
                {/* PIN Dots */}
                <div className="flex justify-center gap-4 my-8">
                  {[0, 1, 2, 3].map(i => (
                    <div 
                      key={i} 
                      className={`w-5 h-5 rounded-full transition-all duration-200 ${
                        i < pin.length ? 'bg-indigo-600 scale-110 shadow-md' : 'bg-slate-100 border border-slate-200'
                      }`} 
                    />
                  ))}
                </div>

                {error && (
                  <div className="flex items-center justify-center gap-2 text-red-600 text-sm font-medium bg-red-50 p-4 rounded-xl border border-red-100">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              <PinPad pin={pin} onNumPad={handleNumPad} onDelete={handleDelete} disabled={!selectedStaff || isLoading} />
            </>
          )}

          {bankState === 'NEEDS_SERVER_BANK' && (
            <div className="flex flex-col h-full animate-in slide-in-from-right-4">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <Banknote className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Start Personal Shift Bank</h3>
                <p className="text-slate-500 mt-2">Welcome {authData?.operator?.firstName}!</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Opening Float (Optional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-lg">₦</span>
                  <input 
                    type="number"
                    min="0"
                    step="100"
                    value={openingFloat}
                    onChange={e => setOpeningFloat(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-white border border-slate-300 rounded-xl text-lg font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-3">Leave as 0 if you are starting with no cash.</p>

                {error && (
                  <div className="mt-4 flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button size="lg" className="h-14 text-lg rounded-xl" onClick={handleStartShift} disabled={isLoading}>
                  {isLoading ? 'Starting...' : 'Start Shift'}
                </Button>
                <Button variant="outline" size="lg" className="h-14 rounded-xl" onClick={() => setBankState('NONE')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {bankState === 'CENTRAL_CASHIER_UNAVAILABLE' && (
            <div className="flex flex-col h-full items-center justify-center text-center animate-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
                <ShieldAlert className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">Central Cashier Unavailable</h3>
              <p className="text-slate-600 leading-relaxed mb-8">
                The central till has not been opened. Please contact a manager to open the till before you can place orders.
              </p>
              <Button variant="outline" size="lg" className="w-full h-14 text-lg rounded-xl" onClick={() => setBankState('NONE')}>
                Back
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
