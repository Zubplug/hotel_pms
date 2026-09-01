import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Percent, Hash } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { ManagerOverrideModal } from '../pos/ManagerOverrideModal';

type TargetType = 'RESERVATION_ROOM' | 'FOLIO_ITEM';

type FrontDeskDiscountModalProps = {
  isOpen: boolean;
  targetType: TargetType;
  targetId: string;
  targetTotal?: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function FrontDeskDiscountModal({ isOpen, targetType, targetId, targetTotal, onClose, onSuccess }: FrontDeskDiscountModalProps) {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [type, setType] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Supervisor Override State
  const [showOverride, setShowOverride] = useState(false);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (pin?: string) => {
    if (!value || isNaN(Number(value)) || Number(value) <= 0) {
      setError('Please enter a valid discount value.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required for discounts.');
      return;
    }

    const numValue = Number(value);
    const amount = type === 'amount' ? numValue : 0;
    const percentage = type === 'percent' ? numValue : 0;

    setIsLoading(true);
    setError('');

    try {
      const payload = {
        targetType,
        targetId,
        discountType: type === 'amount' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
        discountAmount: amount,
        discountPercent: percentage,
        reason,
        managerPin: pin
      };

      const res = await provider.approvals.requestDiscount(payload);
      
      if (res.requiresApproval) {
        if (isDesktopMode) {
          if (typeof window !== 'undefined' && (window as any).chrome?.webview) {
            setShowOverride(true);
          } else {
            setError('Discount exceeds your limit. A request has been sent for manager approval.');
            onSuccess();
          }
        } else {
          setError('Discount exceeds your limit. A request has been sent for manager approval.');
          onSuccess();
        }
      } else if (!res.success) {
        setError(res.error || 'Failed to apply discount.');
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverrideAuthorized = (managerId: string, managerPin: string, reasonFromModal: string) => {
    setShowOverride(false);
    if (managerPin) {
      // The modal reason could potentially override the form reason, but we'll stick to the form reason if they match or just pass managerPin.
      handleSubmit(managerPin);
    } else {
      setError('Failed to capture manager PIN.');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
            <h2 className="text-xl font-bold text-slate-800">Apply Discount</h2>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                {error}
              </div>
            )}

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  type === 'percent' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setType('percent')}
              >
                <Percent className="w-4 h-4" /> Percentage
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  type === 'amount' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setType('amount')}
              >
                <Hash className="w-4 h-4" /> Fixed Amount
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Discount {type === 'percent' ? 'Percentage' : 'Amount'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  {type === 'percent' ? '%' : '₦'}
                </div>
                <input
                  type="number"
                  min="0"
                  step={type === 'percent' ? "1" : "0.01"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 rounded-xl border-slate-200 bg-slate-50 text-lg font-semibold text-slate-900 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="block w-full px-4 py-3 rounded-xl border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                placeholder="e.g., Service Recovery, VIP Guest"
                maxLength={100}
              />
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || !value || !reason.trim()}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Applying...' : 'Apply Discount'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ManagerOverrideModal
        isOpen={showOverride}
        actionName="Discount Override"
        onAuthorized={(id, pin, r) => handleOverrideAuthorized(id, pin, r)}
        onCancel={() => setShowOverride(false)}
      />
    </>
  );
}
