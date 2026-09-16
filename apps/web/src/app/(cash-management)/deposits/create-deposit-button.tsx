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
import { CheckCircle2, Loader2, Plus } from 'lucide-react';

export function CreateDepositButton({
  propertyId,
  posSessionIds,
  frontdeskSessionIds,
}: {
  propertyId: string;
  posSessionIds: string[];
  frontdeskSessionIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const router = useRouter();

  const create = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/v1/financial-control/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          posSessionIds,
          frontdeskSessionIds,
          bankName: bankName.trim() || undefined,
          bankAccount: bankAccount.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to create deposit');
      setState('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create deposit');
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
        <Plus className="h-4 w-4" />
        Create Bank Deposit
        {totalSessions > 0 && (
          <span className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
            {totalSessions}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (state !== 'loading' ? setOpen(v) : undefined)}>
        <DialogContent className="rounded-2xl border-slate-200 sm:max-w-lg">
          {(state === 'idle' || state === 'loading') && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-indigo-600" />Create bank deposit</DialogTitle>
                <DialogDescription>
                  Bundle {totalSessions} received handover{totalSessions !== 1 ? 's' : ''} into one deposit record. You can then submit it to the bank.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Deposit batch</p><p className="mt-1 text-sm font-semibold text-slate-800">{totalSessions} received handover{totalSessions !== 1 ? 's' : ''} selected</p><p className="mt-1 text-xs text-slate-500">This creates a controlled banking record ready for bank submission.</p></div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Bank name <span className="font-normal normal-case text-slate-400">(optional)</span><Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Enter receiving bank"
                  disabled={state === 'loading'}
                  className="mt-1.5 rounded-xl"
                /></label>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">Bank account <span className="font-normal normal-case text-slate-400">(optional)</span><Input
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Enter destination account number"
                  disabled={state === 'loading'}
                  className="mt-1.5 rounded-xl"
                /></label>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={state === 'loading'}
                >
                  Cancel
                </Button>
                <Button
                  onClick={create}
                  disabled={state === 'loading'}
                  className="gap-2"
                >
                  {state === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {state === 'loading' ? 'Creating…' : 'Create Deposit'}
                </Button>
              </DialogFooter>
            </>
          )}

          {state === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Deposit Created
                </DialogTitle>
                <DialogDescription>
                  The selected handovers are now grouped into a pending bank deposit ready for submission.
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
                <DialogTitle>Unable to Create Deposit</DialogTitle>
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
