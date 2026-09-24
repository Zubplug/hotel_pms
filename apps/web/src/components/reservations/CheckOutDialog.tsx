'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function CheckOutDialog({ open, onOpenChange, reservation, folio }: { open: boolean, onOpenChange: (open: boolean) => void, reservation: any, folio: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkipperConfirm, setShowSkipperConfirm] = useState(false);
  
  const { data: session } = useSession();
  const userRole = String((session?.user as any)?.role || 'STAFF').toUpperCase();
  const canCheckoutSkipper = ['MANAGER', 'ACCOUNTANT', 'NIGHT_AUDITOR', 'ADMIN', 'SUPER_ADMIN', 'GENERAL_CASHIER'].includes(userRole);

  const queryClient = useQueryClient();

  const balance = Number(folio?.balance || 0);

  const handleCheckOut = async (forceSkipper = false) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceSkipper }),
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
          {balance > 0 && !showSkipperConfirm && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Settlement Required</AlertTitle>
              <AlertDescription>
                This guest has an outstanding balance of {folio.currency} {balance.toFixed(2)}. You must settle the folio before checking them out.
              </AlertDescription>
            </Alert>
          )}
          
          {balance > 0 && showSkipperConfirm && (
            <Alert variant="destructive" className="border-red-600 bg-red-50 text-red-900 [&>svg]:text-red-700">
              <ShieldAlert className="h-5 w-5" />
              <AlertTitle className="text-red-800 font-bold">Manager Override: Skipper Checkout</AlertTitle>
              <AlertDescription className="mt-2 text-sm text-red-800">
                You are about to flag this guest as a Walk-Out (Skipper).<br/><br/>
                This will instantly zero their front desk folio and route the <strong>{folio.currency} {balance.toFixed(2)}</strong> debt to the City Ledger Accounts Receivable (AR) for accounting recovery.<br/><br/>
                <strong>Only proceed if you are certain the guest has walked out without paying.</strong>
              </AlertDescription>
            </Alert>
          )}

          {balance < 0 && (
            <Alert className="bg-blue-50 border-blue-500 text-blue-800 [&>svg]:text-blue-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Guest Credit: {folio.currency} {Math.abs(balance).toFixed(2)}</AlertTitle>
              <AlertDescription>
                This folio has a {folio.currency} {Math.abs(balance).toFixed(2)} credit balance. No refund has been processed. Checking out will retain the {folio.currency} {Math.abs(balance).toFixed(2)} as guest credit for this guest, which can be refunded or applied to a future stay.
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
          {showSkipperConfirm ? (
            <>
              <Button variant="outline" onClick={() => setShowSkipperConfirm(false)} disabled={isSubmitting}>
                Cancel Override
              </Button>
              <Button 
                onClick={() => handleCheckOut(true)} 
                disabled={isSubmitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Skipper Route
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              {balance > 0 && canCheckoutSkipper && (
                <Button 
                  variant="destructive"
                  onClick={() => setShowSkipperConfirm(true)} 
                  disabled={isSubmitting}
                  className="bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 mr-auto"
                >
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Check Out as Skipper
                </Button>
              )}
              <Button 
                onClick={() => handleCheckOut(false)} 
                disabled={isSubmitting || balance > 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {balance < 0 ? 'Check Out & Retain Credit' : 'Confirm Check-Out'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
