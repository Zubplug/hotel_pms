'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, HelpCircle, Receipt } from 'lucide-react';
import { toast } from 'sonner';

interface ComplimentaryVerificationResolutionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: any[]; // Combined unverified complimentary records
  propertyId: string;
  onSuccess: () => void;
}

export function ComplimentaryVerificationResolution({
  open,
  onOpenChange,
  records,
  propertyId,
  onSuccess
}: ComplimentaryVerificationResolutionProps) {
  const router = useRouter();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'VIEW' | 'QUESTION' | 'SUCCESS'>('VIEW');
  const [successType, setSuccessType] = useState<'VERIFIED' | 'UNRESOLVED' | null>(null);

  // Filter transactions to only those that are PENDING
  const unverifiedRecords = records?.filter(t => t.status === 'PENDING_NIGHT_AUDIT' || t.status === 'UNRESOLVED') || [];
  
  const handleClose = () => {
    setNotes('');
    setMode('VIEW');
    setSuccessType(null);
    setCurrentIndex(0);
    onOpenChange(false);
  };

  const handleContinue = () => {
    setNotes('');
    setSuccessType(null);
    setMode('VIEW');
    setCurrentIndex(0);
    if (unverifiedRecords.length === 0) {
      handleClose();
      onSuccess();
    }
  };

  const record = unverifiedRecords[currentIndex];

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleVerify = async (status: 'VERIFIED' | 'UNRESOLVED') => {
    if (status === 'UNRESOLVED' && !notes.trim()) {
      alert('Please provide a reason for rejecting this complimentary transaction.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/financial-control/complimentary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          id: record.id,
          status,
          rejectionReason: status === 'UNRESOLVED' ? notes : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setSuccessType(status);
      setMode('SUCCESS');
      
      // Update local state without full reload
      record.status = status;
      toast.success(status === 'VERIFIED' ? 'Complimentary transaction verified' : 'Transaction rejected and marked as unresolved');
      
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (unverifiedRecords.length === 0 && mode === 'VIEW') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="border-white/[0.08] shadow-2xl" style={{ background: '#07090f', color: 'white' }}>
          <DialogHeader>
            <DialogTitle>All Verified</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full border border-emerald-400/20 bg-emerald-400/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-lg">No pending verifications</p>
              <p className="text-sm text-slate-400 mt-1">All complimentary records have been reviewed.</p>
            </div>
            <button 
              onClick={() => { handleClose(); onSuccess(); }}
              className="rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/[0.1]"
            >
              Return to Audit
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-[500px] border-white/[0.08] shadow-[0_40px_120px_rgba(0,0,0,0.8)] p-0 overflow-hidden" style={{ background: '#07090f', color: 'white' }}>
        
        {/* Header Section */}
        <div className="relative px-6 py-6 border-b border-white/[0.08]" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(124,58,237,0.05) 100%)' }}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2 text-white">
                  <Receipt className="w-5 h-5 text-indigo-400" />
                  Verify Complimentary
                </DialogTitle>
                <DialogDescription className="mt-1 text-slate-400">
                  {currentIndex + 1} of {unverifiedRecords.length + currentIndex} pending review
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6">
          {mode === 'SUCCESS' && (
            <div className="flex flex-col items-center justify-center py-4 text-center space-y-4">
              <div className={`h-16 w-16 rounded-full border flex items-center justify-center ${successType === 'VERIFIED' ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
                {successType === 'VERIFIED' ? (
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                ) : (
                  <HelpCircle className="h-8 w-8 text-amber-400" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg text-white">{successType === 'VERIFIED' ? 'Verified Successfully' : 'Marked Unresolved'}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {unverifiedRecords.length > 0 ? `${unverifiedRecords.length} remaining to review` : 'All records processed'}
                </p>
              </div>
              <button 
                onClick={handleContinue} 
                className="w-full mt-4 rounded-xl border border-indigo-400/30 bg-indigo-500/20 px-4 py-2 text-sm font-bold text-indigo-300 transition-all hover:bg-indigo-500/30"
              >
                {unverifiedRecords.length > 0 ? 'Review Next Record' : 'Return to Audit'}
              </button>
            </div>
          )}

          {mode !== 'SUCCESS' && record && (
            <div className="space-y-6">
              {/* Receipt Summary Card */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Receipt className="h-24 w-24 text-white" />
                </div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em]">{record.complType}</p>
                    <p className="text-2xl font-bold mt-1 text-white tabular-nums">{formatCurrency(Number(record.complAmount))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-300">Ref: {record.reference}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{record.sourceModule}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm relative z-10">
                  <div>
                    <p className="text-slate-500 text-[11px] mb-1">Reason</p>
                    <p className="font-medium text-slate-200">{record.reason}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[11px] mb-1">Gross Amount</p>
                    <p className="font-medium text-slate-200 tabular-nums">{formatCurrency(Number(record.grossAmount))}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[11px] mb-1">Operator</p>
                    <p className="font-medium text-slate-200">
                      {record.operator?.firstName ? `${record.operator.firstName} ${record.operator.lastName}` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[11px] mb-1">Beneficiary (Staff)</p>
                    <p className="font-medium text-slate-200">
                      {record.staff?.firstName ? `${record.staff.firstName} ${record.staff.lastName}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {mode === 'VIEW' ? (
                <div className="flex gap-3 pt-2">
                  <button 
                    className="w-full rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-300 transition-all hover:bg-rose-400/20"
                    onClick={() => setMode('QUESTION')}
                  >
                    Reject
                  </button>
                  <button 
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-400/20 disabled:opacity-50"
                    onClick={() => handleVerify('VERIFIED')}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Verify Record
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-white/[0.08]">
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-rose-400 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Reason for Rejection
                    </Label>
                    <Textarea 
                      id="notes" 
                      placeholder="Explain why this complimentary transaction is being rejected..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="resize-none border-rose-400/20 bg-rose-400/[0.02] text-white focus-visible:ring-rose-400/30"
                      rows={3}
                      autoFocus
                    />
                    <p className="text-[11px] text-slate-400">This will mark the record as UNRESOLVED and block the Night Audit until financially reversed or accepted.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/[0.1]"
                      onClick={() => setMode('VIEW')}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button 
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-300 transition-all hover:bg-rose-400/20 disabled:opacity-50"
                      onClick={() => handleVerify('UNRESOLVED')}
                      disabled={isSubmitting || !notes.trim()}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Reject Record
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
