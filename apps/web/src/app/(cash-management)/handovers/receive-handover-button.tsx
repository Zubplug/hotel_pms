'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2 } from 'lucide-react';

export function ReceiveHandoverButton({ handoverId, currentStatus }: { handoverId: string, currentStatus: string }) {
  const [isReceiving, setIsReceiving] = useState(false);
  const [dialog, setDialog] = useState<'confirm' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  if (currentStatus !== 'PENDING') {
    return null;
  }

  const handleReceive = async () => {
    setDialog('confirm');
  };

  const confirmReceive = async () => {
    setIsReceiving(true);
    try {
      const res = await fetch(`/api/v1/financial-control/handovers/${handoverId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Received from UI' })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to receive handover');
      }
      
      setDialog('success');
    } catch (error: any) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to receive handover');
      setDialog('error');
    } finally {
      setIsReceiving(false);
    }
  };

  return <>
    <Button onClick={handleReceive} disabled={isReceiving} size="sm">{isReceiving ? 'Receiving...' : 'Receive'}</Button>
    <Dialog open={dialog !== null} onOpenChange={open => !open && !isReceiving && setDialog(null)}>
      <DialogContent>
        {dialog === 'confirm' && <><DialogHeader><DialogTitle>Receive cash handover?</DialogTitle><DialogDescription>This confirms that you have physically received custody of this cash. The action cannot be undone.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDialog(null)} disabled={isReceiving}>Cancel</Button><Button onClick={confirmReceive} disabled={isReceiving}>{isReceiving ? 'Receiving...' : 'Confirm receipt'}</Button></DialogFooter></>}
        {dialog === 'success' && <><DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Cash received successfully</DialogTitle><DialogDescription>The linked shift is now operationally complete and marked HANDED OVER.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => { setDialog(null); router.refresh(); }}>Continue</Button></DialogFooter></>}
        {dialog === 'error' && <><DialogHeader><DialogTitle>Unable to receive handover</DialogTitle><DialogDescription>{errorMessage}</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setDialog(null)}>Close</Button></DialogFooter></>}
      </DialogContent>
    </Dialog>
  </>;
}
