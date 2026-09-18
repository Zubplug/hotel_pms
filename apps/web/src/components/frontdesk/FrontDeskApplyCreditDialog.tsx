'use client';

import { useEffect, useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Wallet, CheckCircle2, AlertCircle, AlertTriangle, WifiOff } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useProperty } from '@/components/PropertyProvider';

export function FrontDeskApplyCreditDialog({
  open,
  onOpenChange,
  folio,
  guestId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folio: any;
  guestId: string;
}) {
  const [amount, setAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const queryClient = useQueryClient();
  const { provider, isOnline } = useLodgeCoreProvider();
  const { propertyId } = useProperty();

  // ── Fetch latest credit availability (works both online and offline) ────────
  const { data: creditsData, isLoading: isLoadingCredits } = useQuery({
    queryKey: ['guest-credits-detail', guestId, propertyId],
    queryFn: async () => {
      const res = await provider.guestCredits.list(propertyId);
      const all: any[] = Array.isArray(res) ? res : ((res as any)?.data ?? []);
      return all.find((c: any) => c.guestId === guestId) ?? null;
    },
    enabled: open && !!guestId,
    refetchOnMount: 'always',
  });

  const availableAmount = Number(creditsData?.availableAmount ?? 0);
  const conflictedAllocations: any[] = creditsData?.conflictedAllocations ?? [];
  const hasConflicts = conflictedAllocations.length > 0;

  useEffect(() => {
    if (open) {
      setAmount('');
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Amount must be greater than zero');
      }
      if (numAmount > availableAmount) {
        throw new Error('Amount cannot exceed available credit');
      }

      // Use the provider — handles both online (REST) and offline (IPC) paths.
      const result: any = await provider.guestCredits.apply({
        guestId,
        folioId: folio.id,
        amount: numAmount,
      });

      if (!result?.success && result?.error) {
        if (result.error === 'INSUFFICIENT_CREDIT') {
          throw new Error(
            "The guest's available credit changed while you were applying it. Please refresh and try again."
          );
        }
        throw new Error(result.error || 'Failed to apply credit');
      }

      if (!isOnline) {
        toast.success('Credit queued — will sync when back online.', { duration: 5000 });
      } else {
        toast.success('Guest credit applied successfully');
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['guest-credits-detail', guestId, propertyId] }),
        queryClient.invalidateQueries({ queryKey: ['frontdesk', 'guestCredits', propertyId] }),
        queryClient.invalidateQueries({ queryKey: ['reservation', folio.reservationId] }),
      ]);

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to apply credit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingCredit = Math.max(0, availableAmount - (Number(amount) || 0));
  const currency = folio?.currency || creditsData?.currency || 'NGN';

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-slate-50/50 rounded-2xl flex flex-col">
        <div className="bg-white px-6 pt-6 pb-4 border-b border-slate-100 relative shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Apply Guest Credit</DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                  Apply credit to Folio{' '}
                  <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    #{folio?.id?.slice(0, 8)?.toUpperCase()}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-6 bg-slate-50/50 relative overflow-y-auto flex-1">
          {/* ── Offline badge ─────────────────────────────────────────────── */}
          {!isOnline && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-xs font-medium text-amber-800 leading-relaxed">
                You are <strong>offline</strong>. The credit application will be queued and synced
                to the cloud when connectivity is restored. If the credit is already consumed
                elsewhere it will be flagged as a conflict.
              </p>
            </div>
          )}

          {/* ── Conflict warning ───────────────────────────────────────────── */}
          {hasConflicts && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div>
                <p className="text-xs font-bold text-red-800">Credit Conflict Detected</p>
                <p className="text-xs text-red-700 leading-relaxed mt-0.5">
                  A previous offline application ({conflictedAllocations.length} allocation
                  {conflictedAllocations.length > 1 ? 's' : ''}) was rejected by the cloud because
                  the credit had already been applied elsewhere. Please review with a manager before
                  applying again.
                </p>
              </div>
            </div>
          )}

          {/* ── Error banner ───────────────────────────────────────────────── */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <p className="text-sm font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {!success ? (
            isLoadingCredits ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Loading available credit...</p>
              </div>
            ) : availableAmount <= 0 && !hasConflicts ? (
              <div className="py-8 text-center text-slate-500">
                <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-medium">No credit available for this guest.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Available credit</p>
                    <p className="text-xl font-bold text-blue-600">{fmt(availableAmount)}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Remaining after</p>
                    <p className="text-xl font-bold text-slate-700">{fmt(remainingCredit)}</p>
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <Label className="text-sm font-bold text-slate-700">Amount to apply ({currency})</Label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      {currency}
                    </div>
                    <Input
                      type="number"
                      step="1"
                      min={1}
                      max={availableAmount}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={isSubmitting || availableAmount <= 0}
                      required
                      className="h-14 pl-14 text-xl font-bold bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                  <DialogClose
                    render={
                      <Button type="button" variant="outline" className="h-12 px-6 rounded-xl font-semibold border-slate-200" disabled={isSubmitting}>
                        Cancel
                      </Button>
                    }
                  />
                  <Button
                    type="submit"
                    disabled={isSubmitting || !amount || Number(amount) <= 0 || Number(amount) > availableAmount || availableAmount <= 0}
                    className="h-12 px-8 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Wallet className="w-5 h-5 mr-2" />
                    )}
                    {isOnline ? 'Apply Credit' : 'Queue Credit (Offline)'}
                  </Button>
                </div>
              </form>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner relative">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-50 animate-ping"></div>
                <CheckCircle2 className="w-10 h-10 text-emerald-600 relative z-10" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {isOnline ? 'Credit Applied' : 'Credit Queued'}
                </h3>
                <p className="text-slate-500 mt-2 text-sm max-w-[280px] mx-auto">
                  {fmt(Number(amount))} has been {isOnline ? 'applied to the folio.' : 'queued and will sync when online.'}
                </p>
              </div>
              <div className="w-full max-w-sm space-y-3 pt-4">
                <Button
                  onClick={() => { setSuccess(false); onOpenChange(false); }}
                  variant="outline"
                  className="w-full h-14 rounded-xl font-bold border-slate-200 text-slate-600"
                >
                  Return to Reservation
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
