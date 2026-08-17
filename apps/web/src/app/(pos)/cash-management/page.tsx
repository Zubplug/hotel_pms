'use client';

import React, { useState, useEffect } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDownToLine, ArrowUpFromLine, Receipt, RefreshCcw, HandCoins, AlertCircle, Check } from 'lucide-react';
import { StaffSwitchPad } from '@/components/pos/StaffSwitchPad';

type CashMovement = {
  id: string;
  amount: number;
  type: string;
  reasonCode: string;
  notes?: string;
  createdAt: string;
  userId: string;
};

export default function CashManagementPage() {
  const { provider } = useLodgeCoreProvider();
  const { data: session } = useLodgeCoreSession();
  const sessionId = (session as any)?.sessionId;
  const propertyId = (session?.user as any)?.propertyId;

  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form state
  const [mvtType, setMvtType] = useState('CASH_DROP');
  const [amount, setAmount] = useState('');
  const [reasonCode, setReasonCode] = useState('SAFE_DROP');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auth Pad state
  const [showAuthPad, setShowAuthPad] = useState(false);
  const [pendingMovement, setPendingMovement] = useState<any>(null);

  const fetchMovements = async () => {
    if (!sessionId) return;
    try {
      setIsLoading(true);
      const res = await provider.pos.getCashMovements(sessionId);
      if (res.data) setMovements(res.data);
    } catch (e) {
      console.error("Error fetching cash movements", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    const payload = { propertyId, sessionId, amount: amt, type: mvtType, reasonCode, notes };
    
    // In our rules, drops above 100,000 or any paid-out requires supervisor PIN
    if (mvtType === 'PAID_OUT' || mvtType === 'CASH_TRANSFER_OUT' || (mvtType === 'CASH_DROP' && amt >= 100000)) {
      setPendingMovement(payload);
      setShowAuthPad(true);
    } else {
      executeMovement(payload);
    }
  };

  const executeMovement = async (payload: any, authorizerId?: string) => {
    setIsSubmitting(true);
    try {
      const res = await provider.pos.createCashMovement(
        payload.propertyId,
        payload.sessionId,
        payload.amount,
        payload.type,
        payload.reasonCode,
        payload.notes,
        undefined,
        authorizerId
      );
      if (res.success) {
        setSuccessMsg('Cash movement recorded successfully.');
        setAmount('');
        setNotes('');
        fetchMovements();
      } else {
        setError(res.error || 'Failed to record cash movement.');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
      setShowAuthPad(false);
      setPendingMovement(null);
    }
  };

  const formatMoney = (val: number) => `₦${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const getTypeIcon = (type: string) => {
    if (type.includes('DROP')) return <ArrowDownToLine className="w-5 h-5 text-indigo-500" />;
    if (type.includes('OUT')) return <ArrowUpFromLine className="w-5 h-5 text-rose-500" />;
    if (type.includes('FLOAT') || type.includes('IN')) return <HandCoins className="w-5 h-5 text-emerald-500" />;
    return <Receipt className="w-5 h-5 text-slate-500" />;
  };

  if (!sessionId) {
    return <div className="p-8 text-center text-slate-500">No active session found.</div>;
  }

  return (
    <div className="flex h-full bg-slate-50/50">
      {/* Left side: Form */}
      <div className="w-1/3 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Record Movement</h2>
          <p className="text-sm text-slate-500 mt-1">Record safe drops, paid-outs, or transfers.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 flex-1 overflow-y-auto">
          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-start gap-2 border border-rose-100 animate-in fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm flex items-start gap-2 border border-emerald-100 animate-in fade-in">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Movement Type</label>
            <Select value={mvtType} onValueChange={(val) => { setMvtType(val); setReasonCode(''); }}>
              <SelectTrigger className="h-12 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH_DROP">Cash Drop</SelectItem>
                <SelectItem value="PAID_OUT">Paid Out</SelectItem>
                <SelectItem value="CASH_TRANSFER_OUT">Transfer Out</SelectItem>
                <SelectItem value="CASH_TRANSFER_IN">Transfer In</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Reason / Category</label>
            <Select value={reasonCode} onValueChange={setReasonCode} required>
              <SelectTrigger className="h-12 bg-slate-50 border-slate-200">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {mvtType === 'CASH_DROP' && (
                  <>
                    <SelectItem value="SAFE_DROP">Safe Drop</SelectItem>
                    <SelectItem value="BANK_DEPOSIT">Bank Deposit</SelectItem>
                  </>
                )}
                {mvtType === 'PAID_OUT' && (
                  <>
                    <SelectItem value="VENDOR_PAYMENT">Vendor Payment</SelectItem>
                    <SelectItem value="PETTY_CASH">Petty Cash</SelectItem>
                    <SelectItem value="SUPPLIES">Supplies</SelectItem>
                  </>
                )}
                {mvtType.includes('TRANSFER') && (
                  <>
                    <SelectItem value="FRONT_DESK_TRANSFER">Front Desk</SelectItem>
                    <SelectItem value="RESTAURANT_TRANSFER">Restaurant</SelectItem>
                    <SelectItem value="BAR_TRANSFER">Bar</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Amount (₦)</label>
            <Input 
              type="number" 
              step="0.01" 
              min="0"
              required 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 text-2xl font-semibold bg-slate-50 border-slate-200" 
              placeholder="0.00" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Notes (Optional)</label>
            <Input 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-12 bg-slate-50 border-slate-200" 
              placeholder="E.g., Payment for Ice delivery" 
            />
          </div>

          <div className="mt-auto pt-6">
            <Button 
              type="submit" 
              disabled={isSubmitting || !amount || !reasonCode}
              className="w-full h-14 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all active:scale-[0.98]"
            >
              {isSubmitting ? 'Recording...' : 'Record Movement'}
            </Button>
          </div>
        </form>
      </div>

      {/* Right side: History */}
      <div className="w-2/3 p-8 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Today's Ledger</h2>
            <p className="text-slate-500 text-sm mt-1">All cash movements for the current session.</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchMovements} disabled={isLoading} className="text-slate-500">
            <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Time & Type</div>
            <div className="col-span-3">Reason</div>
            <div className="col-span-3">Notes</div>
            <div className="col-span-3 text-right">Amount</div>
          </div>
          
          <div className="overflow-y-auto flex-1 p-2">
            {movements.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <Receipt className="w-12 h-12 mb-4 opacity-20" />
                <p>No cash movements recorded in this session yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {movements.map((m) => (
                  <div key={m.id} className="grid grid-cols-12 gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors items-center">
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        {getTypeIcon(m.type)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-700 text-sm">{m.type.replace(/_/g, ' ')}</div>
                        <div className="text-xs text-slate-500">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                    <div className="col-span-3 text-sm text-slate-600 font-medium">
                      {m.reasonCode.replace(/_/g, ' ')}
                    </div>
                    <div className="col-span-3 text-sm text-slate-500 truncate pr-4">
                      {m.notes || '-'}
                    </div>
                    <div className={`col-span-3 text-right font-bold tracking-tight ${m.type.includes('OUT') || m.type.includes('DROP') ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {m.type.includes('OUT') || m.type.includes('DROP') ? '-' : '+'}{formatMoney(m.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <StaffSwitchPad 
        isOpen={showAuthPad} 
        cancellable={true}
        onCancel={() => {
          setShowAuthPad(false);
          setPendingMovement(null);
        }}
        onAuthenticated={(operator) => {
          executeMovement(pendingMovement, operator.id);
        }} 
      />
    </div>
  );
}
