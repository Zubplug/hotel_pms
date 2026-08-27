'use client';

import React, { useState, useEffect } from 'react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowDownToLine, ArrowUpFromLine, HandCoins, AlertCircle, Check, RefreshCcw, Banknote, ShieldAlert, History } from 'lucide-react';
import { TerminalAuthScreen } from '@/components/pos/TerminalAuthScreen';
import { ActionSuccessModal } from '@/components/pos/ActionSuccessModal';
import { useProperty } from '@/components/PropertyProvider';

export default function CashOfficePage() {
  const { provider } = useLodgeCoreProvider();
  const { propertyId } = useProperty();

  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data state
  const [overview, setOverview] = useState<any>(null);
  const [pendingHandovers, setPendingHandovers] = useState<any[]>([]);
  const [safeLedger, setSafeLedger] = useState<any[]>([]);

  // Form state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositRef, setDepositRef] = useState('');
  const [openSafeAmount, setOpenSafeAmount] = useState('');
  
  // Auth Pad state
  const [showAuthPad, setShowAuthPad] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  
  const [error, setError] = useState('');
  const [successDialog, setSuccessDialog] = useState<{isOpen: boolean, title: string, message: string} | null>(null);

  const fetchData = async () => {
    if (!propertyId) return;
    try {
      setIsLoading(true);
      
      const [ovRes, phRes, slRes] = await Promise.all([
        provider.pos.getCashOfficeOverview(propertyId),
        provider.pos.getPendingHandovers(propertyId),
        provider.pos.getSafeLedger(propertyId)
      ]);

      if (ovRes.data) setOverview(ovRes.data);
      if (phRes.data) setPendingHandovers(phRes.data);
      if (slRes.data) setSafeLedger(slRes.data);
      
    } catch (e) {
      console.error("Failed to fetch cash office data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const handleAction = async (action: any, operator: any) => {
    setError(''); 
    try {
      if (action.type === 'APPROVE_HANDOVER') {
        const res = await provider.pos.confirmHandover(action.sessionId, operator.pin);
        if (res.error) throw new Error(res.error);
        setSuccessDialog({
          isOpen: true,
          title: 'Handover Confirmed',
          message: 'The shift\'s physical cash has been securely transferred to the main safe.'
        });
      } else if (action.type === 'OPEN_SAFE') {
        const res = await provider.pos.openSafe(propertyId, action.amount, operator.pin);
        if (res.error) throw new Error(res.error);
        setSuccessDialog({
          isOpen: true,
          title: 'Safe Opened',
          message: 'The opening float has been securely provisioned to the Cashier.'
        });
        setOpenSafeAmount('');
      } else if (action.type === 'BANK_DEPOSIT') {
        const res = await provider.pos.recordBankDeposit(propertyId, action.amount, action.reference, operator.pin);
        if (res.error) throw new Error(res.error);
        setSuccessDialog({
          isOpen: true,
          title: 'Bank Deposit Recorded',
          message: 'The cash drop has been securely transferred out of the safe to the bank.'
        });
        setDepositAmount('');
        setDepositRef('');
      }
      fetchData();
    } catch (e: any) {
      setError(e.message || 'Operation failed.');
    } finally {
      setShowAuthPad(false);
      setPendingAction(null);
    }
  };

  const formatMoney = (val: number) => `₦${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <div className="p-8 h-full bg-slate-50/50 flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Cash Office</h1>
          <p className="text-slate-500 mt-1">Manage safe ledgers, bank deposits, and shift handovers.</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
          <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-6 self-start bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-slate-100 px-6">Overview</TabsTrigger>
          <TabsTrigger value="handovers" className="rounded-lg data-[state=active]:bg-slate-100 px-6">
            Handover Queue
            {overview?.PendingHandoversCount > 0 && (
              <span className="ml-2 bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {overview.PendingHandoversCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="safe" className="rounded-lg data-[state=active]:bg-slate-100 px-6">Safe Ledger</TabsTrigger>
          <TabsTrigger value="deposits" className="rounded-lg data-[state=active]:bg-slate-100 px-6">Bank Deposits</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="overview" className="mt-0 outline-none">
            {overview && (
              <div className="grid grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <span className="text-slate-500 font-medium text-sm">Safe Balance</span>
                  <span className="text-3xl font-bold mt-2 text-slate-800">{formatMoney(overview.SafeBalance)}</span>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <span className="text-slate-500 font-medium text-sm">Pending Handovers</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-bold text-slate-800">{overview.PendingHandoversCount}</span>
                    <span className="text-slate-400 font-medium text-sm">sessions</span>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <span className="text-slate-500 font-medium text-sm">Cash Awaiting Handover</span>
                  <span className="text-3xl font-bold mt-2 text-rose-600">{formatMoney(overview.PendingCashAmount)}</span>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <span className="text-slate-500 font-medium text-sm">Today's Bank Deposits</span>
                  <span className="text-3xl font-bold mt-2 text-emerald-600">{formatMoney(overview.TodayDeposits)}</span>
                </div>
              </div>
            )}
            
            {/* Safe Initialization prompt if balance is 0 and no ledger entries */}
            {overview?.SafeBalance === 0 && safeLedger.length === 0 && (
              <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col items-center text-center max-w-lg mx-auto">
                <ShieldAlert className="w-12 h-12 text-amber-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Initialize Central Safe</h3>
                <p className="text-slate-600 text-sm mt-2 mb-6">The safe has not been opened yet. Please enter the starting physical cash balance to initialize the cash ledger.</p>
                <div className="flex w-full gap-3">
                  <Input 
                    type="number" 
                    placeholder="Opening Balance (₦)" 
                    value={openSafeAmount} 
                    onChange={e => setOpenSafeAmount(e.target.value)}
                    className="flex-1 bg-white h-12 text-lg font-medium"
                  />
                  <Button 
                    className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                    onClick={() => {
                      setPendingAction({ type: 'OPEN_SAFE', amount: parseFloat(openSafeAmount) });
                      setShowAuthPad(true);
                    }}
                    disabled={!openSafeAmount || parseFloat(openSafeAmount) < 0}
                  >
                    Open Safe
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="handovers" className="mt-0 outline-none">
            {pendingHandovers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Check className="w-12 h-12 mb-4 text-emerald-400" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm">No pending handovers in the queue.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingHandovers.map((h, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-between shadow-sm">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 tracking-tight">Session #{h.Session.Id.substring(0,8).toUpperCase()}</h3>
                      <div className="flex items-center gap-6 mt-3">
                        <div className="flex flex-col">
                          <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Waiter</span>
                          <span className="text-slate-700 font-medium">{h.Session.UserId}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Expected Cash</span>
                          <span className="text-slate-700 font-medium">{formatMoney(h.Settlement?.ExpectedCash)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Declared Cash</span>
                          <span className="text-slate-900 font-bold">{formatMoney(h.Settlement?.ActualCash)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase font-semibold text-slate-400 tracking-wider">Variance</span>
                          <span className={`font-bold ${h.Settlement?.Variance < 0 ? 'text-rose-600' : h.Settlement?.Variance > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {formatMoney(h.Settlement?.Variance)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      className="h-12 px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl"
                      onClick={() => {
                        setPendingAction({ type: 'APPROVE_HANDOVER', sessionId: h.Session.Id });
                        setShowAuthPad(true);
                      }}
                    >
                      Approve Handover
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="safe" className="mt-0 outline-none">
             <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" /> Safe Transaction Ledger
                </h3>
                <div className="text-sm font-medium bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">
                  Current Balance: {formatMoney(overview?.SafeBalance)}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-4 p-4 border-b border-slate-100 bg-white text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-1">Date</div>
                <div className="col-span-1">Type</div>
                <div className="col-span-1">Ref / Reason</div>
                <div className="col-span-1">User</div>
                <div className="col-span-1 text-right">Amount</div>
              </div>
              <div className="divide-y divide-slate-100">
                {safeLedger.length === 0 ? (
                   <div className="p-8 text-center text-slate-400">No transactions in safe ledger yet.</div>
                ) : (
                  safeLedger.map((m, i) => {
                    // Inflows vs outflows
                    const isInflow = m.DestinationAccountId.includes('SAFE');
                    return (
                      <div key={i} className="grid grid-cols-5 gap-4 p-4 items-center hover:bg-slate-50 transition-colors">
                        <div className="col-span-1 text-sm text-slate-500">{new Date(m.CreatedAt).toLocaleString()}</div>
                        <div className="col-span-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${isInflow ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {isInflow ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                            {m.Type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="col-span-1 text-sm text-slate-600 font-medium truncate pr-4">
                          {m.ReceiptReference || m.ReasonCode || m.Notes || '-'}
                        </div>
                        <div className="col-span-1 text-sm text-slate-500">{m.AuthorizedBy || m.UserId}</div>
                        <div className={`col-span-1 text-right text-sm font-bold ${isInflow ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {isInflow ? '+' : '-'}{formatMoney(m.Amount)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deposits" className="mt-0 outline-none max-w-2xl">
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                <Banknote className="w-6 h-6 text-indigo-500" /> Record Bank Deposit
              </h3>
              <p className="text-slate-500 text-sm mb-8">Move physical cash from the safe to the bank account.</p>
              
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Amount (₦)</label>
                  <Input 
                    type="number" 
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    className="h-14 text-2xl font-semibold bg-slate-50 border-slate-200" 
                    placeholder="0.00" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Bank Reference / Deposit Slip No.</label>
                  <Input 
                    value={depositRef}
                    onChange={e => setDepositRef(e.target.value)}
                    className="h-12 bg-slate-50 border-slate-200" 
                    placeholder="E.g., DEP-2023-10-15" 
                  />
                </div>
                <Button 
                  className="w-full h-14 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base rounded-xl shadow-sm transition-all active:scale-[0.98]"
                  onClick={() => {
                    setPendingAction({ type: 'BANK_DEPOSIT', amount: parseFloat(depositAmount), reference: depositRef });
                    setShowAuthPad(true);
                  }}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0 || !depositRef || (overview?.SafeBalance || 0) < parseFloat(depositAmount)}
                >
                  Record Deposit
                </Button>
                {parseFloat(depositAmount) > (overview?.SafeBalance || 0) && (
                   <p className="text-rose-500 text-sm text-center font-medium mt-2">Insufficient funds in Central Safe.</p>
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <TerminalAuthScreen
        authMode="POS_OPERATOR"
        isOpen={showAuthPad}
        cancellable={true}
        onCancel={() => {
          setShowAuthPad(false);
          setPendingAction(null);
        }}
        onAuthenticated={(operator: any) => handleAction(pendingAction, operator)}
      />
      
      {successDialog && (
        <ActionSuccessModal
          isOpen={successDialog.isOpen}
          title={successDialog.title}
          message={successDialog.message}
          onClose={() => setSuccessDialog(null)}
          autoCloseMs={3500}
        />
      )}
    </div>
  );
}
