'use client';

import { useState } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle, FileText, Send } from 'lucide-react';

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
      <DialogContent className="rounded-2xl border-slate-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg"><Send className="h-5 w-5 text-rose-600" />Submit resolution request</DialogTitle>
          <DialogDescription>
            Provide an audit-ready explanation. A manager or finance reviewer will approve the proposed treatment.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-5">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /><div><p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Night audit question</p><p className="mt-1 text-sm leading-5 text-rose-900">{exception.questionReason}</p></div></div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div><span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Amount</span><span className="mt-1 block font-bold text-slate-900">{formatCurrency(amount, currency)}</span></div>
            <div><span className="block text-xs font-medium uppercase tracking-wider text-slate-500">Method</span><span className="mt-1 block font-semibold text-slate-800">{tx?.method || 'Not recorded'}</span></div>
          </div>
          
          <div className="space-y-2"><label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FileText className="h-4 w-4 text-slate-400" />Proposed resolution</label><Select value={reason} onValueChange={(val) => setReason(val || '')}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200">
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
            <label className="text-sm font-semibold text-slate-800">Notes and evidence <span className="font-normal text-slate-400">(required for Other)</span></label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide reference numbers, explanations, or context..."
              className="h-28 resize-none rounded-xl border-slate-200"
            />
            {reason === 'OTHER' && <p className="text-xs text-red-500">* Notes are required for this reason</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !reason}>Submit Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
