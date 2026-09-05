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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>All Verified</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-lg">No pending verifications</p>
              <p className="text-sm text-muted-foreground mt-1">All complimentary records have been reviewed.</p>
            </div>
            <Button onClick={() => { handleClose(); onSuccess(); }}>Return to Audit</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        {mode === 'SUCCESS' && (
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center ${successType === 'VERIFIED' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {successType === 'VERIFIED' ? (
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              ) : (
                <HelpCircle className="h-8 w-8 text-amber-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg">{successType === 'VERIFIED' ? 'Verified Successfully' : 'Marked Unresolved'}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {unverifiedRecords.length > 0 ? `${unverifiedRecords.length} remaining to review` : 'All records processed'}
              </p>
            </div>
            <Button onClick={handleContinue} className="w-full mt-4">
              {unverifiedRecords.length > 0 ? 'Review Next Record' : 'Return to Audit'}
            </Button>
          </div>
        )}

        {mode !== 'SUCCESS' && record && (
          <>
            <DialogHeader>
              <DialogTitle>Verify Complimentary Transaction</DialogTitle>
              <DialogDescription>
                {currentIndex + 1} of {unverifiedRecords.length + currentIndex} pending review
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Receipt Summary Card */}
              <div className="bg-slate-50 border rounded-xl p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Receipt className="h-24 w-24" />
                </div>
                
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{record.complType}</p>
                    <p className="text-2xl font-semibold mt-1 text-slate-900">{formatCurrency(Number(record.complAmount))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Ref: {record.reference}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{record.sourceModule}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm relative z-10">
                  <div>
                    <p className="text-muted-foreground mb-1">Reason</p>
                    <p className="font-medium text-slate-900">{record.reason}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Gross Amount</p>
                    <p className="font-medium text-slate-900">{formatCurrency(Number(record.grossAmount))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Operator</p>
                    <p className="font-medium text-slate-900">
                      {record.operator?.firstName ? `${record.operator.firstName} ${record.operator.lastName}` : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Beneficiary (Staff)</p>
                    <p className="font-medium text-slate-900">
                      {record.staff?.firstName ? `${record.staff.firstName} ${record.staff.lastName}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {mode === 'VIEW' ? (
                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    onClick={() => setMode('QUESTION')}
                  >
                    Reject
                  </Button>
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleVerify('VERIFIED')}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Verify Record
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-rose-700 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      Reason for Rejection
                    </Label>
                    <Textarea 
                      id="notes" 
                      placeholder="Explain why this complimentary transaction is being rejected..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="resize-none"
                      rows={3}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">This will mark the record as UNRESOLVED and block the Night Audit until financially reversed or accepted.</p>
                  </div>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setMode('VIEW')}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive"
                      className="w-full"
                      onClick={() => handleVerify('UNRESOLVED')}
                      disabled={isSubmitting || !notes.trim()}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Reject Record
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
