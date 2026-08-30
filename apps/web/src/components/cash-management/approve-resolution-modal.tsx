'use client';

import { useState } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

interface ApproveResolutionModalProps {
  exception: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApproveResolutionModal({ exception, isOpen, onClose, onSuccess }: ApproveResolutionModalProps) {
  const { data: session } = useLodgeCoreSession();
  const user = session?.user as any;
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tx = exception.payment || exception.posPayment;
  const amount = tx?.amount || 0;
  const currency = tx?.currency || 'NGN';
  const source = exception.payment ? 'Front Desk' : 'POS';

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionNotes.trim()) {
      toast.error('Please provide a reason for rejecting the resolution request.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = action === 'approve' 
        ? `/api/v1/cash-management/transaction-exceptions/${exception.id}/approve`
        : `/api/v1/cash-management/transaction-exceptions/${exception.id}/reject`;

      const body = action === 'approve' 
        ? { approvedById: user?.id }
        : { rejectedById: user?.id, rejectionReason: rejectionNotes };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`Failed to ${action} resolution`);

      toast.success(`Resolution request ${action}d successfully`);
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${action} request`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Review Transaction Exception</DialogTitle>
          <DialogDescription>
            Review the resolution request submitted by the cashier and approve or reject it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 my-4 max-h-[60vh] overflow-y-auto pr-2">
          
          {/* Transaction Context */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">Transaction Details</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500 block">Amount</span><span className="font-semibold text-gray-900">{formatCurrency(amount, currency)}</span></div>
              <div><span className="text-gray-500 block">Source</span><span className="font-medium">{source}</span></div>
              <div><span className="text-gray-500 block">Method</span><span className="font-medium">{tx?.method}</span></div>
              <div><span className="text-gray-500 block">Reference</span><span className="font-medium">{tx?.reference || 'N/A'}</span></div>
            </div>
          </div>

          {/* Question Context */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">Night Audit Flag</h4>
            <div className="bg-red-50 p-3 rounded-md text-sm border border-red-100">
              <span className="text-red-700 block font-medium mb-1">Reason for questioning:</span>
              <span className="text-red-900">{exception.questionReason}</span>
            </div>
          </div>

          {/* Resolution Context */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 border-b pb-2">Proposed Resolution</h4>
            <div className="bg-blue-50 p-3 rounded-md text-sm border border-blue-100">
              <div className="mb-2">
                <span className="text-blue-700 block font-medium">Proposed Action:</span>
                <span className="text-blue-900 font-semibold">{exception.proposedResolution?.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-blue-700 block font-medium">Cashier Notes:</span>
                <span className="text-blue-900">{exception.resolutionNotes || 'No additional notes provided.'}</span>
              </div>
            </div>
          </div>

          {/* Rejection Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Rejection Reason (only if rejecting)</label>
            <Textarea 
              value={rejectionNotes} 
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Explain why this resolution is not acceptable..."
              className="resize-none h-20"
            />
          </div>

        </div>

        <DialogFooter className="flex justify-between sm:justify-between w-full">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <div className="space-x-2">
            <Button variant="destructive" onClick={() => handleAction('reject')} disabled={isSubmitting}>Reject</Button>
            <Button onClick={() => handleAction('approve')} disabled={isSubmitting}>Approve Resolution</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
