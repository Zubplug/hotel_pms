import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Percent, Hash } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useProperty } from '@/components/PropertyProvider';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { COMPLIMENTARY_REASONS, complimentaryReasonLabel } from '@/lib/complimentary-reasons';
import { isConcessionManagementPosition } from '@/lib/concession-accountability';
type TargetType = 'RESERVATION_ROOM' | 'FOLIO_ITEM';

type FrontDeskDiscountModalProps = {
  isOpen: boolean;
  targetType: TargetType;
  targetId: string;
  targetTotal?: number;
  onClose: () => void;
  onSuccess: () => void;
};

function formatAmountInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '');
  const [whole = '', ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, 2);
  const formattedWhole = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fractionParts.length > 0 ? `${formattedWhole || '0'}.${fraction}` : formattedWhole;
}

function numericAmount(value: string) {
  return Number(value.replace(/,/g, ''));
}

export function FrontDeskDiscountModal({ isOpen, targetType, targetId, targetTotal, onClose, onSuccess }: FrontDeskDiscountModalProps) {
  const { provider } = useLodgeCoreProvider();
  const { propertyId } = useProperty();
  const [type, setType] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [beneficiaryType, setBeneficiaryType] = useState<'GUEST' | 'STAFF'>('GUEST');
  const [beneficiaryStaffId, setBeneficiaryStaffId] = useState('');
  const [acknowledgedByStaffId, setAcknowledgedByStaffId] = useState('');
  const [confirmedHighValue, setConfirmedHighValue] = useState(false);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: staffResponse } = useQuery({
    queryKey: ['frontdesk-acknowledging-staff', propertyId],
    queryFn: () => provider.auth.getActiveStaff(),
    enabled: !!propertyId && isOpen,
    staleTime: 300_000,
  });
  const allActiveStaff = (staffResponse as any)?.data || staffResponse || [];
  const activeStaff = allActiveStaff;
  const managementStaff = allActiveStaff.filter((staff: any) => isConcessionManagementPosition(staff.position || staff.role));

  if (!isOpen || !mounted) return null;

  const handleSubmit = async () => {
    const numValue = type === 'amount' ? numericAmount(value) : Number(value);
    if (!value || !Number.isFinite(numValue) || numValue <= 0) {
      setError('Please enter a valid discount value.');
      return;
    }
    if (!reason) {
      setError('Please select an approved reason for the discount.');
      return;
    }
    if (!acknowledgedByStaffId) {
      setError('Please select the staff member who acknowledged this discount.');
      return;
    }
    if (beneficiaryType === 'STAFF' && !beneficiaryStaffId) {
      setError('Please select the staff member receiving this discount.');
      return;
    }
    const isHighValueFixedDiscount = type === 'amount' && Boolean(targetTotal) && numValue >= Number(targetTotal) * 0.5;
    if (isHighValueFixedDiscount && !confirmedHighValue) {
      setError('This discount is at least 50% of the room total. Confirm the amount before submitting.');
      return;
    }
    const amount = type === 'amount' ? numValue : 0;
    const percentage = type === 'percent' ? numValue : 0;

    setIsLoading(true);
    setError('');

    try {
      const payload: Record<string, any> = {
        targetType,
        discountType: type === 'amount' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
        discountAmount: amount,
        discountPercent: percentage,
        reason: complimentaryReasonLabel(reason),
        beneficiaryType,
        beneficiaryStaffId: beneficiaryType === 'STAFF' ? beneficiaryStaffId : null,
        acknowledgedByStaffId,
      };
      // Map targetId to the field name the backend expects per targetType
      if (targetType === 'RESERVATION_ROOM') payload.reservationRoomId = targetId;
      else if (targetType === 'FOLIO_ITEM') { payload.folioId = targetId; payload.targetFolioItemId = targetId; }
      else if (targetType === 'POS_ORDER') payload.orderId = targetId;

      const res = await provider.approvals.requestDiscount(payload);
      
      if (!res.success) {
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
            <h2 className="text-xl font-bold text-slate-800">Request Discount</h2>
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
                onClick={() => { setType('percent'); setConfirmedHighValue(false); }}
              >
                <Percent className="w-4 h-4" /> Percentage
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  type === 'amount' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => { setType('amount'); setConfirmedHighValue(false); }}
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
                  type={type === 'amount' ? 'text' : 'number'}
                  inputMode={type === 'amount' ? 'decimal' : 'numeric'}
                  min="0"
                  step={type === 'percent' ? "1" : "0.01"}
                  value={type === 'amount' ? formatAmountInput(value) : value}
                  onChange={(e) => { setValue(type === 'amount' ? formatAmountInput(e.target.value) : e.target.value); setConfirmedHighValue(false); }}
                  className="block w-full pl-10 pr-4 py-3 rounded-xl border-slate-200 bg-slate-50 text-lg font-semibold text-slate-900 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="0.00"
                />
              </div>
            </div>

            {type === 'amount' && targetTotal && numericAmount(value) >= Number(targetTotal) * 0.5 && (
              <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={confirmedHighValue}
                  onChange={(event) => setConfirmedHighValue(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-600"
                />
                <span>I confirm this discount is at least 50% of the room total and the amount is correct.</span>
              </label>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Benefit recipient</label>
              <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
                {(['GUEST', 'STAFF'] as const).map((kind) => (
                  <button key={kind} type="button" onClick={() => { setBeneficiaryType(kind); if (kind === 'GUEST') setBeneficiaryStaffId(''); }} className={`flex-1 py-2 rounded-lg text-sm font-medium ${beneficiaryType === kind ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                    {kind === 'GUEST' ? 'Guest / customer' : 'Staff member'}
                  </button>
                ))}
              </div>
              {beneficiaryType === 'STAFF' && (
                <SearchableSelect value={beneficiaryStaffId} onChange={setBeneficiaryStaffId} placeholder="Select beneficiary staff" searchPlaceholder="Search active staff…" inputClassName="h-12 rounded-xl bg-slate-50 border-slate-200" options={activeStaff.map((staff: any) => ({ value: staff.id, label: `${staff.firstName} ${staff.lastName}`, searchText: `${staff.firstName} ${staff.lastName} ${staff.role || ''}` }))} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Acknowledged By
              </label>
              <SearchableSelect value={acknowledgedByStaffId} onChange={setAcknowledgedByStaffId} placeholder="Select acknowledging staff" searchPlaceholder="Search management staff…" inputClassName="h-12 rounded-xl bg-slate-50 border-slate-200" options={managementStaff.map((staff: any) => ({ value: staff.id, label: `${staff.firstName} ${staff.lastName}`, searchText: `${staff.firstName} ${staff.lastName} ${staff.position || staff.role || ''}` }))} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Reason
              </label>
              <SearchableSelect value={reason} onChange={setReason} placeholder="Select an approved reason" searchPlaceholder="Search approved reasons…" inputClassName="h-12 rounded-xl bg-slate-50 border-slate-200" options={COMPLIMENTARY_REASONS.map((option) => ({ value: option.value, label: option.label, searchText: option.label }))} />
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
              disabled={isLoading || !value || !reason.trim() || !acknowledgedByStaffId}
              className="flex-1 py-3 px-4 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Submitting...' : 'Submit for Night Audit'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
