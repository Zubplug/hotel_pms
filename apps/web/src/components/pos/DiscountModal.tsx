import React, { useState } from 'react';
import { X, Percent, Hash } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { SupervisorOverrideModal } from './SupervisorOverrideModal';

type DiscountModalProps = {
  isOpen: boolean;
  orderId: string;
  orderTotal: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function DiscountModal({ isOpen, orderId, orderTotal, onClose, onSuccess }: DiscountModalProps) {
  const { provider, isDesktop } = useLodgeCoreProvider();
  const [type, setType] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Supervisor Override State
  const [showOverride, setShowOverride] = useState(false);

  if (!isOpen) return null;

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
        targetType: 'POS_ORDER',
        orderId,
        discountType: type === 'amount' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
        discountAmount: amount,
        discountPercent: percentage,
        reason,
        managerPin: pin
      };

      const res = await provider.approvals.requestDiscount(payload);
      
      if (res.requiresApproval) {
        if (isDesktop) {
          setShowOverride(true);
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

  const handleOverrideAuthorized = (supervisorId: string, supervisorName: string, pin?: string) => {
    setShowOverride(false);
    // Retry with the PIN
    if (pin) {
      handleSubmit(pin);
    } else {
      setError('Failed to capture supervisor PIN.');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">Apply Discount</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
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

          <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
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
        </div>
      </div>

      <SupervisorOverrideModal
        isOpen={showOverride}
        actionName="Discount Override"
        onAuthorized={(id, name, pin) => handleOverrideAuthorized(id, name, pin)}
        onCancel={() => setShowOverride(false)}
      />
    </>
  );
}
