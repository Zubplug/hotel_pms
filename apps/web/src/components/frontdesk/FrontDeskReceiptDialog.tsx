'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';

interface FrontDeskReceiptDialogProps {
  paymentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FrontDeskReceiptDialog({ paymentId, open, onOpenChange }: FrontDeskReceiptDialogProps) {
  if (!paymentId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-y-auto max-h-[90vh] bg-slate-50">
        <PaymentReceipt 
          id={paymentId} 
          onClose={() => onOpenChange(false)} 
          hideBack={false} // Keeping false allows the back button to act as a close button
        />
      </DialogContent>
    </Dialog>
  );
}
