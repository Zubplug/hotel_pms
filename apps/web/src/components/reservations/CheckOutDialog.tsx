'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function CheckOutDialog({ open, onOpenChange, reservation, folio }: { open: boolean, onOpenChange: (open: boolean) => void, reservation: any, folio: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const balance = Number(folio?.balance || 0);

  const handleCheckOut = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/check-out`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check out reservation');

      await queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check Out Guest</DialogTitle>
          <DialogDescription>
            Finalize Reservation #{reservation?.id?.slice(0,8)?.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        {error && <div className="p-3 bg-red-100 text-red-800 text-sm rounded-md">{error}</div>}

        <div className="py-4 space-y-4">
          {balance > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Settlement Required</AlertTitle>
              <AlertDescription>
                This guest has an outstanding balance of {folio.currency} {balance.toFixed(2)}. You must settle the folio before checking them out.
              </AlertDescription>
            </Alert>
          )}

          {balance < 0 && (
            <Alert variant="destructive" className="border-amber-500 text-amber-800 bg-amber-50 [&>svg]:text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Refund / Credit Required</AlertTitle>
              <AlertDescription>
                This guest has a credit balance of {folio.currency} {Math.abs(balance).toFixed(2)}. Please process a refund or credit adjustment before check-out.
              </AlertDescription>
            </Alert>
          )}

          {balance === 0 && (
            <Alert className="bg-emerald-50 border-emerald-500 text-emerald-800 [&>svg]:text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Folio Settled</AlertTitle>
              <AlertDescription>
                The folio balance is zero. Proceeding will check out the guest, mark the room as dirty, and close the folio.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleCheckOut} 
            disabled={isSubmitting || balance !== 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm Check-Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
