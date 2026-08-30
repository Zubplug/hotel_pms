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

interface TransactionVerificationResolutionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: any[]; // Combined unverified transactions
  propertyId: string;
}

export function TransactionVerificationResolution({
  open,
  onOpenChange,
  transactions,
  propertyId,
}: TransactionVerificationResolutionProps) {
  const router = useRouter();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'VIEW' | 'QUESTION'>('VIEW');

  // Filter transactions to only those that are UNVERIFIED
  const unverifiedTransactions = transactions?.filter(t => t.verificationStatus === 'UNVERIFIED') || [];
  
  const handleClose = () => {
    setNotes('');
    setMode('VIEW');
    setCurrentIndex(0);
    onOpenChange(false);
  };

  if (unverifiedTransactions.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>All Transactions Verified</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center text-muted-foreground">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p>No more pending transactions to verify.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const transaction = unverifiedTransactions[currentIndex];
  const isPos = !!transaction.order;
  const transactionType = isPos ? 'POS_PAYMENT' : 'PAYMENT';
  const methodLabel = transaction.method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'POS';
  const reference = transaction.reference || transaction.providerRef || transaction.providerTransactionId || 'N/A';
  
  const cashierName = isPos 
    ? (transaction.session?.operator?.firstName ? `${transaction.session.operator.firstName} ${transaction.session.operator.lastName}` : 'System')
    : (transaction.frontdeskSession?.staff?.firstName ? `${transaction.frontdeskSession.staff.firstName} ${transaction.frontdeskSession.staff.lastName}` : 'System');

  const shiftRef = isPos ? transaction.session?.shiftReference : transaction.frontdeskSession?.shiftReference;
  const folioOrOrder = isPos ? `Order: ${transaction.order?.receiptNumber || transaction.order?.id.slice(-6)}` : `Folio: ${transaction.folio?.folioNumber}`;
  const location = isPos ? transaction.order?.outlet?.name : 'Front Desk';
  const guestName = !isPos && transaction.folio?.reservation?.primaryGuest 
    ? `${transaction.folio.reservation.primaryGuest.firstName} ${transaction.folio.reservation.primaryGuest.lastName}` 
    : 'N/A';

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleVerify = async (status: 'VERIFIED' | 'QUESTIONED') => {
    if (status === 'QUESTIONED' && !notes.trim()) {
      alert('Please provide a reason for questioning this transaction.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/night-audit/resolve/verify-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          transactionId: transaction.id,
          type: transactionType,
          status,
          notes: status === 'QUESTIONED' ? notes : undefined,
          idempotencyKey: `verify-${transaction.id}-${Date.now()}`
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify transaction');
      }

      // Optionally alert on success
      // alert(status === 'VERIFIED' ? 'Transaction verified successfully.' : 'Transaction marked as questioned.');

      // Proceed to next or close
      setNotes('');
      setMode('VIEW');
      
      // Need to refresh the router to get updated data
      router.refresh();
      
      if (currentIndex < unverifiedTransactions.length - 1) {
        // Optimistically wait for router refresh, or we can just stay on current index and let the refresh filter it out
        // Actually, since the component receives `transactions` via props, and `router.refresh()` will update it, 
        // the length of unverifiedTransactions will change. So keeping currentIndex at 0 is safer if we just process them as a queue.
        setCurrentIndex(0);
      } else {
        handleClose();
      }

    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-500" />
            Transaction Verification
          </DialogTitle>
          <DialogDescription>
            Review the transaction details and compare them with the physical or digital receipt. ({unverifiedTransactions.length} remaining)
          </DialogDescription>
        </DialogHeader>

        {mode === 'VIEW' ? (
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div className="text-muted-foreground">Amount</div>
                <div className="font-bold text-lg text-right">{formatCurrency(Number(transaction.amount), transaction.currency)}</div>
                
                <div className="text-muted-foreground">Method</div>
                <div className="text-right font-medium">{methodLabel}</div>

                <div className="text-muted-foreground">Reference</div>
                <div className="text-right font-mono text-xs mt-1">{reference}</div>

                <div className="text-muted-foreground">Date / Time</div>
                <div className="text-right">{new Date(transaction.createdAt).toLocaleString()}</div>

                <div className="col-span-2 border-t my-1"></div>

                <div className="text-muted-foreground">Cashier</div>
                <div className="text-right">{cashierName}</div>

                <div className="text-muted-foreground">Location</div>
                <div className="text-right">{location}</div>

                <div className="text-muted-foreground">Shift Ref</div>
                <div className="text-right text-xs mt-1">{shiftRef || 'N/A'}</div>

                <div className="col-span-2 border-t my-1"></div>

                <div className="text-muted-foreground">Guest / Account</div>
                <div className="text-right">{guestName}</div>

                <div className="text-muted-foreground">Record</div>
                <div className="text-right">{folioOrOrder}</div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                className="w-1/2 mr-2 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950"
                onClick={() => setMode('QUESTION')}
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                Question
              </Button>
              <Button
                className="w-1/2 ml-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleVerify('VERIFIED')}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Verify
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-amber-800 dark:text-amber-300 text-sm">
              You are questioning this transaction. It will remain an outstanding financial exception for Finance/Management to follow up on.
            </div>
            
            <div className="space-y-2">
              <Label>Reason / Observation (Required)</Label>
              <Textarea
                placeholder="e.g., Bank reference does not match receipt, amount differs, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="ghost"
                onClick={() => setMode('VIEW')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={() => handleVerify('QUESTIONED')}
                disabled={isSubmitting || !notes.trim()}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Question
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
