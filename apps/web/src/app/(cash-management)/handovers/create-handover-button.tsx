'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Loader2, ArrowLeftRight } from 'lucide-react';

export function CreateHandoverButton({
  propertyId,
  posSessionIds,
  frontdeskSessionIds,
}: {
  propertyId: string;
  posSessionIds: string[];
  frontdeskSessionIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [safeReference, setSafeReference] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const router = useRouter();

  const create = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/v1/financial-control/handovers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          propertyId,
          posSessionIds,
          frontdeskSessionIds,
          safeReference: safeReference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to create handover');
      setState('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create handover');
      setState('error');
    }
  };

  const totalSessions = posSessionIds.length + frontdeskSessionIds.length;

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-white text-slate-800 border border-white/20 hover:bg-white/90 gap-2 font-semibold shadow-sm"
      >
        <ArrowLeftRight className="h-4 w-4" />
        Create Handover
        {totalSessions > 0 && (
          <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
            {totalSessions}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (state !== 'loading' ? setOpen(v) : undefined)}>
        <DialogContent className="sm:max-w-md">
          {(state === 'idle' || state === 'loading') && (
            <>
              <DialogHeader>
                <DialogTitle>Create Cash Handover</DialogTitle>
                <DialogDescription>
                  This places {totalSessions} approved shift{totalSessions !== 1 ? 's' : ''} into custody transfer. The receiving cashier must confirm physical receipt.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Input
                  value={safeReference}
                  onChange={(e) => setSafeReference(e.target.value)}
                  placeholder="Safe reference (optional)"
                  disabled={state === 'loading'}
                />
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  disabled={state === 'loading'}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={state === 'loading'}
                >
                  Cancel
                </Button>
                <Button onClick={create} disabled={state === 'loading'} className="gap-2">
                  {state === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {state === 'loading' ? 'Creating…' : 'Confirm Handover'}
                </Button>
              </DialogFooter>
            </>
          )}

          {state === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Handover Created
                </DialogTitle>
                <DialogDescription>
                  The selected shifts are now pending cash receipt confirmation from the receiving cashier.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setOpen(false);
                    router.refresh();
                  }}
                >
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {state === 'error' && (
            <>
              <DialogHeader>
                <DialogTitle>Unable to Create Handover</DialogTitle>
                <DialogDescription>{error}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setState('idle')}>Try Again</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
