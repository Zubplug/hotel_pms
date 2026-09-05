import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, User, Users, Hash } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TargetType = 'RESERVATION_ROOM' | 'FOLIO_ITEM';

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
  
  const [beneficiaryType, setBeneficiaryType] = useState<'GUEST' | 'STAFF'>('GUEST');
  const [beneficiaryStaffId, setBeneficiaryStaffId] = useState('');
  const [benefitType, setBenefitType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [amount, setAmount] = useState('');
  const [settlementType, setSettlementType] = useState<'PAY_NOW' | 'STAFF_PAY_LATER'>('STAFF_PAY_LATER');
  const [acknowledgedByStaffId, setAcknowledgedByStaffId] = useState('');
  const [reason, setReason] = useState('');
  
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
    if (beneficiaryType === 'STAFF' && !beneficiaryStaffId) {
      setError('Please select the staff member receiving the benefit.');
      return;
    }
    if (!acknowledgedByStaffId) {
      setError('Please select the staff member who authorized this.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required.');
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
        beneficiaryType,
        beneficiaryStaffId: beneficiaryType === 'STAFF' ? beneficiaryStaffId : null,
        compType: benefitType,
        compAmount: numValue,
        settlementType: beneficiaryType === 'STAFF' ? settlementType : 'PAY_NOW',
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
          <h2 className="text-xl font-bold text-slate-800">Apply Complimentary</h2>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Beneficiary Type
            </label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  beneficiaryType === 'GUEST' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setBeneficiaryType('GUEST')}
              >
                <User className="w-4 h-4" /> Guest
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  beneficiaryType === 'STAFF' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setBeneficiaryType('STAFF')}
              >
                <Users className="w-4 h-4" /> Staff
              </button>
            </div>
          </div>

          {beneficiaryType === 'STAFF' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Staff Beneficiary
              </label>
              <Select value={beneficiaryStaffId} onValueChange={(val) => setBeneficiaryStaffId(val || "")}>
                <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select staff member" />
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
          )}

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

          {beneficiaryType === 'STAFF' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Settlement
              </label>
              <Select value={settlementType} onValueChange={(val: any) => setSettlementType(val)}>
                <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select settlement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF_PAY_LATER">Staff Pay Later</SelectItem>
                  <SelectItem value="PAY_NOW">Pay Now</SelectItem>
                </SelectContent>
              </Select>
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Acknowledged / Authorized By
            </label>
            <Select value={acknowledgedByStaffId} onValueChange={(val) => setAcknowledgedByStaffId(val || "")}>
              <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 border-slate-200">
                <SelectValue placeholder="Select authorizer" />
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
            {isLoading ? 'Applying...' : 'Apply Complimentary'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
