'use client';

import { useState, useEffect } from 'react';
import { User, AlertCircle, X } from 'lucide-react';
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
      provider.auth.getActiveStaff().then(res => {
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
      const authRes = await provider.auth.login(selectedStaff.id, pin);

      if (!authRes.error && authRes.success) {
        // auth.login sets the session in the backend. 
        // We fetch the updated session immediately to pass to onAuthenticated.
        const sessionResStr = await provider.auth.getSession();
        const sessionRes = typeof sessionResStr === 'string' ? JSON.parse(sessionResStr) : sessionResStr;
        if (sessionRes.success && sessionRes.data?.user) {
           onAuthenticated(sessionRes.data.user, sessionRes.data.sessionId);
        } else {
           onAuthenticated(selectedStaff, "desktop_token");
        }
      } else {
        setError(authRes.error || 'Authentication failed');
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
                onClick={() => setSelectedStaff(s)}
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
                <span className="text-sm font-medium text-slate-500 mt-1">{s.role}</span>
              </button>
            ))}
            
            {staff.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-12">
                Loading staff profiles...
              </div>
            )}
          </div>
        </div>

        {/* Right Side - PIN Pad */}
        <div className="w-full md:w-[420px] p-10 flex flex-col h-[640px] bg-white">
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
        </div>

      </div>
    </div>
  );
}
