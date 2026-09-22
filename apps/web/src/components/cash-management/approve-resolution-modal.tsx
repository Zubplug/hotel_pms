'use client';

import { useState } from 'react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileCheck2 } from 'lucide-react';

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
      <DialogContent className="rounded-2xl border-white/10 bg-[#101b2f] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-white"><FileCheck2 className="h-5 w-5 text-indigo-300" />Review resolution request</DialogTitle>
          <DialogDescription className="text-slate-400">
            Validate the transaction context and the cashier’s evidence before closing this audit exception.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 max-h-[62vh] space-y-5 overflow-y-auto pr-2">
          
          {/* Transaction Context */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Transaction details</h4>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[.035] p-4 text-sm sm:grid-cols-4">
              <div><span className="block text-xs text-slate-500">Amount</span><span className="mt-1 block font-bold text-white">{formatCurrency(amount, currency)}</span></div>
              <div><span className="block text-xs text-slate-500">Source</span><span className="mt-1 block font-semibold text-slate-200">{source}</span></div>
              <div><span className="block text-xs text-slate-500">Method</span><span className="mt-1 block font-semibold text-slate-200">{tx?.method || '—'}</span></div>
              <div><span className="block text-xs text-slate-500">Reference</span><span className="mt-1 block truncate font-semibold text-slate-200" title={tx?.reference || ''}>{tx?.reference || '—'}</span></div>
            </div>
          </div>

          {/* Question Context */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Night audit flag</h4>
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm"><div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0 text-rose-300" /><div><span className="block font-semibold text-rose-300">Reason for questioning</span><span className="mt-1 block leading-5 text-rose-100">{exception.questionReason}</span></div></div>
            </div>
          </div>

          {/* Resolution Context */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Proposed resolution</h4>
            <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-4 text-sm">
              <div className="mb-2">
                <span className="block font-medium text-indigo-300">Proposed action</span>
                <span className="font-semibold capitalize text-indigo-100">{exception.proposedResolution?.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="block font-medium text-indigo-300">Cashier notes</span>
                <span className="text-indigo-100">{exception.resolutionNotes || 'No additional notes provided.'}</span>
              </div>
            </div>
          </div>

          {/* Rejection Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-200">Rejection reason <span className="font-normal text-slate-500">(required when rejecting)</span></label>
            <Textarea 
              value={rejectionNotes} 
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder="Explain why this resolution is not acceptable..."
              className="h-24 resize-none rounded-xl border-white/10 bg-white/[.05] text-white placeholder:text-slate-500"
            />
          </div>

        </div>

        <DialogFooter className="w-full gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <div className="space-x-2">
            <Button variant="destructive" onClick={() => handleAction('reject')} disabled={isSubmitting} className="gap-2"><AlertTriangle className="h-4 w-4" />Reject</Button>
            <Button onClick={() => handleAction('approve')} disabled={isSubmitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" />Approve resolution</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
