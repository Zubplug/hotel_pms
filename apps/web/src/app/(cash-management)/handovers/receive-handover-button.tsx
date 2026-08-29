'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Loader2, PackageCheck } from 'lucide-react';

export function ReceiveHandoverButton({
  handoverId,
  currentStatus,
}: {
  handoverId: string;
  currentStatus: string;
}) {
  const [isReceiving, setIsReceiving] = useState(false);
  const [dialog, setDialog] = useState<'confirm' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  if (currentStatus !== 'PENDING') return null;

  const confirmReceive = async () => {
    setIsReceiving(true);
    try {
      const res = await fetch(
        `/api/v1/financial-control/handovers/${handoverId}/receive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Received from UI' }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to receive handover');
      }
      setDialog('success');
    } catch (error: any) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to receive handover'
      );
      setDialog('error');
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setDialog('confirm')}
        disabled={isReceiving}
        size="sm"
        className="gap-1.5 text-xs font-semibold"
      >
        {isReceiving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <PackageCheck className="h-3.5 w-3.5" />
        )}
        {isReceiving ? 'Receiving…' : 'Receive'}
      </Button>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && !isReceiving && setDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          {dialog === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>Receive Payment Handover?</DialogTitle>
                <DialogDescription>
                  This confirms that you received the physical cash and the listed payment receipts. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialog(null)}
                  disabled={isReceiving}
                >
                  Cancel
                </Button>
                <Button onClick={confirmReceive} disabled={isReceiving} className="gap-2">
                  {isReceiving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isReceiving ? 'Receiving…' : 'Confirm Receipt'}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Payment Handover Received Successfully
                </DialogTitle>
                <DialogDescription>
                  The linked shift is now operationally complete and marked as Handed Over.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setDialog(null);
                    router.refresh();
                  }}
                >
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle>Unable to Receive Handover</DialogTitle>
                <DialogDescription>{errorMessage}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setDialog(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
