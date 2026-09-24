import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert, LogOut, ArrowRight, Wallet, CreditCard, Key } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CheckOutDialog({ open, onOpenChange, reservation, folio }: { open: boolean, onOpenChange: (open: boolean) => void, reservation: any, folio: any }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkipperConfirm, setShowSkipperConfirm] = useState(false);
  
  const { data: session } = useSession();
  const userRole = String((session?.user as any)?.role || 'STAFF').toUpperCase();
  const canCheckoutSkipper = ['MANAGER', 'ACCOUNTANT', 'NIGHT_AUDITOR', 'ADMIN', 'SUPER_ADMIN', 'GENERAL_CASHIER'].includes(userRole);

  const queryClient = useQueryClient();

  const balance = Number(folio?.balance || 0);
  const currency = folio?.currency || 'NGN';

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

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if(!isSubmitting) onOpenChange(val); }}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl bg-white/95 backdrop-blur-xl">
        
        {/* Header Section */}
        <div className="bg-slate-950 px-6 py-8 relative overflow-hidden">
          {/* Decorative background blur */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 mb-2">
                <Key className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Finalize Stay</span>
              </div>
              <DialogTitle className="text-2xl font-bold text-white tracking-tight">Check Out Guest</DialogTitle>
              <DialogDescription className="text-slate-400 mt-1.5 text-sm">
                Reservation <span className="font-mono text-slate-300">#{reservation?.id?.slice(0,8)?.toUpperCase()}</span>
              </DialogDescription>
            </div>
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
              <LogOut className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 shadow-sm animate-in fade-in slide-in-from-top-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!showSkipperConfirm ? (
            <div className={cn(
              "rounded-2xl p-5 border relative overflow-hidden transition-all duration-300",
              balance > 0 ? "bg-rose-50/50 border-rose-200" : 
              balance < 0 ? "bg-blue-50/50 border-blue-200" : 
              "bg-emerald-50/50 border-emerald-200"
            )}>
              {/* Subtle gradient overlay */}
              <div className={cn(
                "absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-br",
                balance > 0 ? "from-rose-500 to-transparent" : 
                balance < 0 ? "from-blue-500 to-transparent" : 
                "from-emerald-500 to-transparent"
              )} />
              
              <div className="relative z-10 flex items-start gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                  balance > 0 ? "bg-white text-rose-600" : 
                  balance < 0 ? "bg-white text-blue-600" : 
                  "bg-white text-emerald-600"
                )}>
                  {balance > 0 ? <Wallet className="w-5 h-5" /> : 
                   balance < 0 ? <CreditCard className="w-5 h-5" /> : 
                   <CheckCircle2 className="w-5 h-5" />}
                </div>
                
                <div className="flex-1 pt-0.5">
                  <h4 className={cn(
                    "font-bold text-sm uppercase tracking-wider mb-1",
                    balance > 0 ? "text-rose-700" : 
                    balance < 0 ? "text-blue-700" : 
                    "text-emerald-700"
                  )}>
                    {balance > 0 ? "Outstanding Balance" : 
                     balance < 0 ? "Guest Credit Available" : 
                     "Zero Balance"}
                  </h4>
                  
                  <div className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                    {formatMoney(Math.abs(balance))}
                  </div>
                  
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {balance > 0 
                      ? "This guest has an unpaid balance. The folio must be settled before standard check-out can proceed."
                      : balance < 0
                      ? "A credit remains on this folio. Proceeding will retain this amount as guest credit for future use or refunds."
                      : "The folio is fully settled. Checking out will mark the room as dirty and close the reservation."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 bg-red-50 border-2 border-red-200 animate-in zoom-in-95 duration-200 shadow-sm">
              <div className="flex items-center gap-3 text-red-700 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-lg tracking-tight">Manager Override: Skipper Route</h4>
              </div>
              <p className="text-sm text-red-800/90 leading-relaxed font-medium">
                You are authorizing a <strong className="text-red-950 bg-red-200/50 px-1 py-0.5 rounded">Walk-Out (Skipper)</strong> action for this reservation.
              </p>
              <div className="mt-4 p-4 bg-white rounded-xl border border-red-100 shadow-sm">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Debt to transfer</span>
                  <span className="font-bold text-red-700 text-base">{formatMoney(balance)}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
                  <span>This balance will be zeroed out on the front desk folio and routed to the <strong>City Ledger (Accounts Receivable)</strong>.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-100 p-6 flex flex-col-reverse sm:flex-row items-center gap-3 justify-end rounded-b-2xl">
          {showSkipperConfirm ? (
            <>
              <Button 
                variant="ghost" 
                onClick={() => setShowSkipperConfirm(false)} 
                disabled={isSubmitting}
                className="w-full sm:w-auto font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              >
                Cancel Override
              </Button>
              <Button 
                onClick={() => handleCheckOut(true)} 
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-600/20 transition-all hover:shadow-red-600/30"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                Confirm Skipper Route
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)} 
                disabled={isSubmitting}
                className="w-full sm:w-auto font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              >
                Cancel
              </Button>
              
              {balance > 0 && canCheckoutSkipper && (
                <Button 
                  variant="outline"
                  onClick={() => setShowSkipperConfirm(true)} 
                  disabled={isSubmitting}
                  className="w-full sm:w-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 font-semibold transition-colors mr-auto"
                >
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Force Skipper Route
                </Button>
              )}

              <Button 
                onClick={() => handleCheckOut(false)} 
                disabled={isSubmitting || balance > 0}
                className={cn(
                  "w-full sm:w-auto font-bold shadow-lg transition-all",
                  balance > 0 ? "bg-slate-200 text-slate-400 shadow-none" : 
                  "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20 hover:shadow-slate-900/30"
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                {balance < 0 ? 'Retain Credit & Check Out' : 'Confirm Check Out'}
              </Button>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
