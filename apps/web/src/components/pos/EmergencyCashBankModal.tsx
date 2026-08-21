import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { toast } from 'sonner';

interface EmergencyCashBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
  operatorToken: string;
}

export function EmergencyCashBankModal({ isOpen, onClose, onSuccess, operatorToken }: EmergencyCashBankModalProps) {
  const provider = useLodgeCoreProvider();
  const [isProcessing, setIsProcessing] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenBank = async () => {
    setErrorMsg(null);
    if (!managerPin || managerPin.length < 4) {
      setErrorMsg('Valid Manager PIN is required.');
      return;
    }
    if (!reason || reason.length < 5) {
      setErrorMsg('Please provide a descriptive reason for opening an emergency bank.');
      return;
    }

    setIsProcessing(true);
    try {
      const openRes = await provider.pos.startEmergencyBank(
        managerPin,
        reason,
        operatorToken
      );

      if (openRes.error) {
        setErrorMsg(openRes.error);
      } else if (openRes.data?.sessionId) {
        toast.success('Emergency Bank Opened', {
          description: `Bank successfully minted for Manager Override.`
        });
        onSuccess(openRes.data.sessionId);
        onClose();
      } else {
        setErrorMsg('Failed to open emergency bank.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-white rounded-xl shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Emergency Cash Override</DialogTitle>
          </div>
          <DialogDescription className="text-slate-600">
            Central Cashier is unavailable. A manager authorization is required to process this transaction. This will grant temporary financial authority to process payments on behalf of the current waiter.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-sm font-medium rounded-md border border-red-200">
              {errorMsg}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Reason</label>
            <input 
              type="text" 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              placeholder="e.g. Cashier shift delayed, Internet down..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Manager Authorization PIN</label>
            <div className="relative">
              <input 
                type="password" 
                className="w-full p-3 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="****"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                disabled={isProcessing}
              />
              <ShieldCheck className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleOpenBank}
            disabled={isProcessing}
            className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing...</>
            ) : (
              'Authorize Emergency Cashier'
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
