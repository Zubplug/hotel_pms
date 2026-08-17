'use client';

import { useState, useEffect } from 'react';
import { User, Lock, AlertCircle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';

type StaffSwitchPadProps = {
  isOpen: boolean;
  onAuthenticated: (operator: any, token?: string) => void;
  onCancel?: () => void;
  cancellable?: boolean;
};

export function StaffSwitchPad({ isOpen, onAuthenticated, onCancel, cancellable = false }: StaffSwitchPadProps) {
  const { provider } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const propertyId = (session?.user as any)?.propertyId || '';

  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleLogin = async () => {
    if (!selectedStaff || pin.length < 4) return;
    setIsLoading(true);
    setError('');

    try {
      const outletId = (session as any)?.outletId || localStorage.getItem('lodgecore_pos_outlet_id') || '';
      const deviceId = (session as any)?.deviceId || localStorage.getItem('lodgecore_pos_device_id') || '';

      // Desktop IPC Call to check PIN against SQLite PosPinHash, Web API Call requires all 6
      const operatorRes = await provider.pos.authenticateOperator(
        selectedStaff.id, 
        pin, 
        propertyId, 
        (session as any)?.sessionId || '',
        outletId,
        deviceId
      );

      if (!operatorRes.error && operatorRes.data) {
        onAuthenticated(operatorRes.data.staff, operatorRes.data.operatorToken);
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
                onClick={() => setSelectedStaff(s)}
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
                <span className="text-xs text-slate-500 mt-1">{s.role}</span>
              </button>
            ))}
            
            {staff.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-10">
                Loading staff...
              </div>
            )}
          </div>
        </div>

        {/* Right Side - PIN Pad */}
        <div className="w-full md:w-96 p-8 flex flex-col h-[600px]">
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
        </div>

      </div>
    </div>
  );
}
