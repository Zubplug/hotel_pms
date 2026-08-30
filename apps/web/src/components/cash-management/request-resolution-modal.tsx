'use client';

import { useState } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface RequestResolutionModalProps {
  exception: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_CODES = [
  { value: 'BANK_DELAY', label: 'Bank Delay / Pending Transfer' },
  { value: 'BANK_TRANSFER_CONFIRMED', label: 'Bank Transfer Confirmed' },
  { value: 'STAFF_DEDUCTION', label: 'Staff Deduction (Propose)' },
  { value: 'STAFF_REIMBURSEMENT', label: 'Staff Reimbursement' },
  { value: 'CASHIER_ACCOUNTABILITY', label: 'Cashier Accountability' },
  { value: 'DUPLICATE_TRANSACTION', label: 'Duplicate Transaction' },
  { value: 'WRONG_AMOUNT', label: 'Wrong Amount' },
  { value: 'WRONG_ACCOUNT', label: 'Wrong Account' },
  { value: 'WRONG_PAYMENT_METHOD', label: 'Wrong Payment Method' },
  { value: 'TRANSACTION_CORRECTION', label: 'Transaction Correction' },
  { value: 'OTHER', label: 'Other' },
];

export function RequestResolutionModal({ exception, isOpen, onClose, onSuccess }: RequestResolutionModalProps) {
  const { data: session } = useLodgeCoreSession();
  const user = session?.user as any;
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tx = exception.payment || exception.posPayment;
  const amount = tx?.amount || 0;
  const currency = tx?.currency || 'NGN';

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a resolution reason');
      return;
    }

    if (reason === 'OTHER' && !notes.trim()) {
      toast.error('Notes are required when selecting "Other"');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/cash-management/transaction-exceptions/${exception.id}/request-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedResolution: reason,
          resolutionNotes: notes,
          requestedById: user?.id,
        })
      });

      if (!res.ok) throw new Error('Failed to submit resolution');

      toast.success('Resolution request submitted successfully');
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Resolution</DialogTitle>
          <DialogDescription>
            Provide an explanation for the questioned transaction to be reviewed by management.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="p-4 bg-red-50 rounded-md border border-red-100 text-sm">
            <p className="font-semibold text-red-800">Transaction Questioned</p>
            <p className="text-red-700 mt-1">{exception.questionReason}</p>
          </div>

          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-sm font-medium text-gray-500">Amount</span>
            <span className="font-semibold text-gray-900">{formatCurrency(amount, currency)}</span>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Proposed Resolution</label>
            <Select value={reason} onValueChange={(val) => setReason(val || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason code..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_CODES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Notes & Evidence</label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide reference numbers, explanations, or context..."
              className="resize-none h-24"
            />
            {reason === 'OTHER' && <p className="text-xs text-red-500">* Notes are required for this reason</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !reason}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
