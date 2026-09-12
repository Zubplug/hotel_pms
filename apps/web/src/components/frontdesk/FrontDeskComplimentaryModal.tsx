import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { User } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TargetType = 'RESERVATION_ROOM' | 'FOLIO_ITEM' | 'POS_ORDER';

type FrontDeskComplimentaryModalProps = {
  isOpen: boolean;
  targetType: TargetType;
  targetId: string;
  targetTotal?: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function FrontDeskComplimentaryModal({ isOpen, targetType, targetId, targetTotal, onClose, onSuccess }: FrontDeskComplimentaryModalProps) {
  const { provider } = useLodgeCoreProvider();
  const { propertyId } = useProperty();
  
  const [benefitType, setBenefitType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [acknowledgedByStaffId, setAcknowledgedByStaffId] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: managersRes } = useQuery({
    queryKey: ['managers-local', propertyId],
    queryFn: async () => {
      return provider.auth.getActiveStaff();
    },
    enabled: !!propertyId && isOpen,
    staleTime: 300_000,
  });
  const activeStaff = (managersRes as any)?.data || [];

  if (!isOpen || !mounted) return null;

  const handleSubmit = async () => {
    if (benefitType === 'PARTIAL' && (!amount || isNaN(Number(amount)) || Number(amount) <= 0)) {
      setError('Please enter a valid partial complimentary amount.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    if (!acknowledgedByStaffId) {
      setError('Please select the staff member who acknowledged this complimentary request.');
      return;
    }

    const numValue = benefitType === 'PARTIAL' ? Number(amount) : (targetTotal || 0);

    setIsLoading(true);
    setError('');

    try {
      const payload = {
        targetType,
        reservationRoomId: targetType === 'RESERVATION_ROOM' ? targetId : undefined,
        orderId: targetType === 'POS_ORDER' ? targetId : undefined,
        compType: benefitType,
        compAmount: numValue,
        reason,
        acknowledgedByStaffId,
      };

      const res = await provider.approvals.requestComplimentary(payload);
      
      if (!res.success) {
        setError(res.error || 'Failed to apply complimentary.');
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Request Complimentary</h2>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <User className="h-4 w-4" /> Complimentary benefit applies to the guest only.
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Acknowledged By
            </label>
            <Select value={acknowledgedByStaffId} onValueChange={(val) => setAcknowledgedByStaffId(val || '')}>
              <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 border-slate-200">
                <SelectValue placeholder="Select acknowledging staff" />
              </SelectTrigger>
              <SelectContent>
                {activeStaff.map((staff: any) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Benefit Type
            </label>
            <Select value={benefitType} onValueChange={(val: any) => setBenefitType(val)}>
              <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 border-slate-200">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL">Full Complimentary (100%)</SelectItem>
                <SelectItem value="PARTIAL">Partial Complimentary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {benefitType === 'PARTIAL' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Partial Amount
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  ₦
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 rounded-xl border-slate-200 bg-slate-50 text-lg font-semibold text-slate-900 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}


          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full px-4 py-3 rounded-xl border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:ring-blue-500 transition-colors"
              placeholder="e.g., Promotion, Duty Meal"
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
            onClick={handleSubmit}
            disabled={isLoading || !reason.trim() || !acknowledgedByStaffId}
            className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Submitting...' : 'Submit for Night Audit'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
