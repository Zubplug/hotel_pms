import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, FileCheck2, Building2, X, Wallet } from 'lucide-react';

export function CheckOutDialog({ open, onOpenChange, reservation, folio }: { open: boolean, onOpenChange: (open: boolean) => void, reservation: any, folio: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const queryClient = useQueryClient();

  const balance = Number(folio?.balance || 0);
  const currency = folio?.currency || 'NGN';

  const handleCheckOut = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Always force skipper logic to route to city ledger
        body: JSON.stringify({ forceSkipper: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to checkout to City Ledger');

      await queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  // Reset confirmation state when dialog closes/opens
  const handleOpenChange = (val: boolean) => {
    if (!isSubmitting) {
      setShowConfirm(false);
      onOpenChange(val);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border border-white/10 shadow-[0_0_80px_-15px_rgba(0,0,0,0.7)] rounded-3xl bg-[#0a0f1c] text-slate-200">
        
        {/* Subtle top glare/gradient */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 flex items-start justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                <Building2 className="w-3 h-3" />
                <span>City Ledger Checkout</span>
              </div>
              <DialogTitle className="text-2xl font-bold text-white tracking-tight mb-2">Check Out Guest</DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                Reservation <span className="font-mono text-slate-300 bg-white/5 px-1.5 py-0.5 rounded">#{reservation?.id?.slice(0,8)?.toUpperCase()}</span>
              </DialogDescription>
            </div>
            <button 
              onClick={() => handleOpenChange(false)}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/5"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Body */}
          <div className="px-8 pb-6 space-y-6">
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <p className="text-sm font-medium leading-relaxed">{error}</p>
              </div>
            )}

            {!showConfirm ? (
              <div className="rounded-3xl p-6 border relative overflow-hidden backdrop-blur-xl bg-white/5 border-white/10 transition-all duration-300 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 text-indigo-400 shadow-inner">
                  <Wallet className="w-6 h-6" />
                </div>
                
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2 text-indigo-400">
                  Outstanding Balance
                </h4>
                
                <div className="text-4xl font-black text-white tracking-tight mb-4 drop-shadow-sm">
                  {formatMoney(balance)}
                </div>
                
                <p className="text-sm text-slate-400 leading-relaxed max-w-[90%] mx-auto">
                  Transfer this folio balance directly to the City Ledger (Accounts Receivable) and complete the check-out process.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl p-6 bg-indigo-500/10 border-2 border-indigo-500/30 relative overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2 tracking-tight">Confirm City Ledger Routing</h4>
                  <p className="text-sm text-indigo-200/70 leading-relaxed">
                    You are about to zero out this front desk folio and route the debt for accounting recovery.
                  </p>
                </div>
                
                <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center text-sm mb-3 pb-3 border-b border-white/10">
                    <span className="text-slate-400 font-medium">Debt to transfer</span>
                    <span className="font-bold text-indigo-400 text-lg">{formatMoney(balance)}</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs text-slate-400">
                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
                    <p className="leading-relaxed">Guest room will be marked dirty and reservation status set to CHECKED_OUT.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-8 pb-8 flex items-center gap-3 justify-end">
            {!showConfirm ? (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => handleOpenChange(false)} 
                  disabled={isSubmitting}
                  className="flex-1 h-12 px-6 rounded-2xl font-bold text-slate-400 hover:text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                
                <Button 
                  onClick={() => setShowConfirm(true)} 
                  disabled={isSubmitting}
                  className="flex-1 h-12 px-6 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] border border-indigo-500 transition-all"
                >
                  Checkout to City Ledger
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => setShowConfirm(false)} 
                  disabled={isSubmitting}
                  className="flex-[0.7] h-12 px-4 rounded-2xl font-bold text-slate-400 hover:text-white hover:bg-white/5"
                >
                  Go Back
                </Button>
                
                <Button 
                  onClick={handleCheckOut} 
                  disabled={isSubmitting}
                  className="flex-1 h-12 px-6 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold shadow-[0_0_25px_-5px_rgba(99,102,241,0.6)] transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileCheck2 className="w-5 h-5 mr-2" />}
                  Confirm Transfer
                </Button>
              </>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
