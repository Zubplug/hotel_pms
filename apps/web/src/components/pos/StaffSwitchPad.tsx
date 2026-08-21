'use client';

import { useState, useEffect } from 'react';
import { User, AlertCircle, X, Banknote, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

type StaffSwitchPadProps = {
  isOpen: boolean;
  onAuthenticated: (operator: any, token?: string) => void;
  onCancel?: () => void;
  cancellable?: boolean;
  outletId?: string;
};

export function StaffSwitchPad({ isOpen, onAuthenticated, onCancel, cancellable = false, outletId }: StaffSwitchPadProps) {
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
    if (isOpen && propertyId) {
      provider.pos.getActiveStaff(propertyId).then(res => {
        if (res.data) setStaff(res.data);
      }).catch(console.error);
    }
  }, [isOpen, propertyId, provider]);

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
    const needsTillRole = ['WAITER', 'BARTENDER', 'CASHIER'].includes(staffObj.role || staffObj.position);
    
    if (authRes.requiresBank) {
      setBankState('CENTRAL_CASHIER_UNAVAILABLE');
    } else if (
      !authRes.posSessionId && 
      !authRes.sessionId && 
      !localStorage.getItem('lodgecore_pos_session_id') &&
      authRes.bankingModel === 'SERVER_BANKING' &&
      needsTillRole
    ) {
      setAuthData({ operator: staffObj, token });
      setBankState('NEEDS_SERVER_BANK');
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
      const posSessionId = localStorage.getItem('lodgecore_pos_session_id') || (session as any)?.sessionId || '';
      const finalOutletId = outletId || (session as any)?.outletId || localStorage.getItem('lodgecore_pos_outlet_id') || '';
      const deviceId = (session as any)?.deviceId || localStorage.getItem('lodgecore_pos_device_id') || '';

      const operatorRes = await provider.pos.authenticateOperator(
        selectedStaff.id, 
        pin, 
        propertyId, 
        posSessionId,
        finalOutletId,
        deviceId
      );

      if (!operatorRes.error && operatorRes.data) {
        // Handle desktop returning authRes shape vs Web API returning data shape
        const authDataBlock = operatorRes.data;
        await handleProcessLoginSuccess(authDataBlock, authDataBlock.staff, authDataBlock.operatorToken);
      } else {
        setError(operatorRes.error || 'Authentication failed');
        setPin('');
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
        const res = await provider.pos.startSession({
          userId: authData.operator.id,
          propertyId,
          deviceId,
          outletId: req.outletId,
          openingCash: req.openingCash
        });
        
        if (res && !res.error && res.data) {
          localStorage.setItem('lodgecore_pos_session_id', res.data.sessionId || '');
          onAuthenticated(authData.operator, authData.token);
        } else {
          setError(res?.error || 'Failed to start shift on desktop');
        }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200">
        
        {/* Left Side - Staff Selection */}
        <div className="flex-1 bg-slate-50 p-8 border-r border-slate-200 h-[600px] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Select Operator</h2>
            {cancellable && (
              <Button variant="ghost" size="icon" onClick={onCancel} className="text-slate-500 hover:text-slate-700">
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
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                  selectedStaff?.id === s.id 
                    ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                    : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${
                  selectedStaff?.id === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <User className="w-6 h-6" />
                </div>
                <span className="font-semibold text-slate-800">{s.firstName} {s.lastName}</span>
                <span className="text-xs text-slate-500 mt-1">{s.role || s.position}</span>
              </button>
            ))}
            
            {staff.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-10">
                Loading staff...
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Dynamic */}
        <div className="w-full md:w-96 p-8 flex flex-col h-[600px]">
          
          {bankState === 'NONE' && (
            <>
              <div className="text-center mb-8">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  {selectedStaff ? `Enter PIN for ${selectedStaff.firstName}` : 'Select a user first'}
                </h3>
                
                {/* PIN Dots */}
                <div className="flex justify-center gap-3 my-6">
                  {[0, 1, 2, 3].map(i => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full transition-colors ${
                        i < pin.length ? 'bg-indigo-600' : 'bg-slate-200'
                      }`} 
                    />
                  ))}
                </div>

                {error && (
                  <div className="flex items-center justify-center gap-2 text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-auto">
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      disabled={!selectedStaff || isLoading}
                      onClick={() => handleNumPad(num.toString())}
                      className="h-16 rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-800 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 transition-colors"
                    >
                      {num}
                    </button>
                  ))}
                  <div />
                  <button
                    disabled={!selectedStaff || isLoading}
                    onClick={() => handleNumPad('0')}
                    className="h-16 rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-800 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 transition-colors"
                  >
                    0
                  </button>
                  <button
                    disabled={!selectedStaff || isLoading || pin.length === 0}
                    onClick={handleDelete}
                    className="h-16 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 flex items-center justify-center transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </>
          )}

          {bankState === 'NEEDS_SERVER_BANK' && (
            <div className="flex flex-col h-full animate-in slide-in-from-right-4">
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Banknote className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Start Personal Shift Bank</h3>
                <p className="text-slate-500 mt-1 text-sm">Welcome {authData?.operator?.firstName}!</p>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6 flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Opening Float (Optional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">₦</span>
                  <input 
                    type="number"
                    min="0"
                    step="100"
                    value={openingFloat}
                    onChange={e => setOpeningFloat(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Leave as 0 if starting with no cash.</p>

                {error && (
                  <div className="mt-4 flex items-center gap-2 text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 mt-auto">
                <Button size="lg" className="h-12 text-base rounded-xl" onClick={handleStartShift} disabled={isLoading}>
                  {isLoading ? 'Starting...' : 'Start Shift'}
                </Button>
                <Button variant="outline" size="lg" className="h-12 rounded-xl" onClick={() => setBankState('NONE')}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {bankState === 'CENTRAL_CASHIER_UNAVAILABLE' && (
            <div className="flex flex-col h-full items-center justify-center text-center animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Central Cashier Unavailable</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                The central till has not been opened. Please contact a manager to open the till.
              </p>
              <Button variant="outline" size="lg" className="w-full h-12 rounded-xl" onClick={() => setBankState('NONE')}>
                Back
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
