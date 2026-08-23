'use client';

import React, { useState, useEffect } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Calculator, AlertTriangle, UserCheck, Scale } from 'lucide-react';
import { TerminalAuthScreen } from '@/components/pos/TerminalAuthScreen';

export default function SettlementPage() {
  const { provider } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const sessionId = (session as any)?.sessionId;
  const propertyId = (session?.user as any)?.propertyId;

  const [isLoading, setIsLoading] = useState(true);
  const [expectedCash, setExpectedCash] = useState<number | null>(null);
  
  const [actualCashStr, setActualCashStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [showAuthPad, setShowAuthPad] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const fetchDetails = async () => {
      try {
        const res = await provider.pos.getSessionSettlementDetails(sessionId);
        if (!res.error && res.data) {
          setExpectedCash(res.data.expectedCash);
        } else {
          setError(res.error || 'Failed to fetch settlement details.');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetails();
  }, [sessionId, provider]);

  const actualCash = parseFloat(actualCashStr) || 0;
  const variance = expectedCash !== null ? actualCash - expectedCash : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (expectedCash === null) return;
    
    // Variance requires supervisor approval
    if (variance !== 0) {
      setShowAuthPad(true);
    } else {
      executeSettlement();
    }
  };

  const executeSettlement = async (authorizerId?: string) => {
    if (!sessionId) return;
    setIsSubmitting(true);
    setError('');
    
    try {
      const res = await provider.pos.settleSession(sessionId, actualCash, (session?.user as any)?.id, authorizerId);
      if (!res.error) {
        setSuccess(true);
      } else {
        setError(res.error || 'Failed to settle session.');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
      setShowAuthPad(false);
    }
  };

  const formatMoney = (val: number) => `₦${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  if (success) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Session Settled</h2>
          <p className="text-slate-500 mb-8">
            Your POS session has been closed successfully. The data will sync to the cloud automatically.
          </p>
          <Button 
            onClick={() => window.location.href = '/pos/start-shift'}
            className="w-full h-14 text-base font-semibold bg-slate-900 hover:bg-slate-800 rounded-xl"
          >
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return <div className="p-8 text-center text-slate-500">No active session found.</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        
        <div className="p-8 border-b border-slate-100 text-center bg-slate-900 text-white">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-slate-300 opacity-50" />
          <h1 className="text-3xl font-bold tracking-tight">End of Shift Settlement</h1>
          <p className="text-slate-400 mt-2 font-medium">Reconcile your drawer and close the session securely.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm flex items-start gap-3 border border-rose-100">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Expected Cash</div>
              <div className="text-4xl font-bold text-slate-800">
                {expectedCash !== null ? formatMoney(expectedCash) : '...'}
              </div>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <div className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-2">Actual Cash</div>
              <Input 
                type="number"
                step="0.01"
                min="0"
                required
                value={actualCashStr}
                onChange={(e) => setActualCashStr(e.target.value)}
                placeholder="0.00"
                className="h-12 text-3xl font-bold bg-transparent border-0 border-b-2 border-blue-200 focus-visible:ring-0 focus-visible:border-blue-500 px-0 rounded-none shadow-none text-blue-900 placeholder:text-blue-200"
              />
            </div>
          </div>

          {expectedCash !== null && actualCashStr !== '' && (
            <div className={`p-6 rounded-2xl flex items-center justify-between border ${variance === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
              <div className="flex items-center gap-3">
                <Scale className={`w-6 h-6 ${variance === 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wider opacity-80">Variance</div>
                  <div className="font-medium mt-0.5">
                    {variance === 0 
                      ? "Drawer perfectly balanced" 
                      : variance > 0 
                        ? `Over by ${formatMoney(variance)}` 
                        : `Short by ${formatMoney(Math.abs(variance))}`}
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight">
                {variance > 0 ? '+' : ''}{formatMoney(variance)}
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={isSubmitting || expectedCash === null || actualCashStr === ''}
            className="w-full h-16 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-sm transition-all active:scale-[0.98]"
          >
            {isSubmitting ? 'Processing...' : variance !== 0 ? 'Request Supervisor Approval to Settle' : 'Settle Session'}
          </Button>
        </form>
      </div>

      <TerminalAuthScreen
        authMode="POS_OPERATOR"
        isOpen={showAuthPad}
        cancellable={true}
        onCancel={() => setShowAuthPad(false)}
        onAuthenticated={(operator: any) => {
          executeSettlement(operator.id);
        }}
      />
    </div>
  );
}
