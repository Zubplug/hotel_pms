import React, { useState, useEffect } from 'react';
import { Shield, AlertCircle, X } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { PinPad } from './PinPad';

type SupervisorOverrideModalProps = {
  isOpen: boolean;
  actionName: string; // e.g., 'Void Item', 'Cash Drawer Open'
  onAuthorized: (supervisorId: string, supervisorName: string, pin?: string) => void;
  onCancel: () => void;
};

export function SupervisorOverrideModal({ isOpen, actionName, onAuthorized, onCancel }: SupervisorOverrideModalProps) {
  const { provider } = useLodgeCoreProvider();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
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
    if (pin.length < 4) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await provider.pos.validateSupervisorPin(pin);
      if (!res.error && res.data) {
        onAuthorized(res.data.staffId, res.data.name, pin);
      } else {
        setError(res.error || 'Invalid supervisor PIN.');
        setPin('');
      }
    } catch (e: any) {
      setError(e.message || 'Authorization failed.');
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col p-8 animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Supervisor Required</h2>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-slate-500 mb-6 text-sm">
          A manager or supervisor must enter their PIN to authorize: <span className="font-semibold text-slate-700">{actionName}</span>
        </p>

        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-colors ${
                i < pin.length ? 'bg-red-500' : 'bg-slate-200'
              }`} 
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-red-600 text-sm font-medium bg-red-50 p-3 rounded-lg mb-6">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <PinPad pin={pin} onNumPad={handleNumPad} onDelete={handleDelete} disabled={isLoading} />
        
      </div>
    </div>
  );
}
