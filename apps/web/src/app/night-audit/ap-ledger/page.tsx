'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Banknote, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import { getAccountsPayable } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FolioDetailView } from '@/components/finance/FolioDetailView';
import { format } from 'date-fns';

export default function AccountsPayableLedgerPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const [viewingFolioId, setViewingFolioId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['night-audit', 'ap-ledger', propertyId],
    queryFn: () => getAccountsPayable(propertyId),
    enabled: !!propertyId,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
          Failed to load Accounts Payable. Please try again.
        </div>
      </div>
    );
  }

  const { negativeFolios, credits } = data as any;

  // Negative balances are liabilities (hotel owes guest). Multiply by -1 to show positive liability amount.
  const totalRefundsOwed = negativeFolios.reduce((sum: number, f: any) => sum + Math.abs(Number(f.balance || 0)), 0);
  const totalUnappliedCredits = credits.reduce((sum: number, c: any) => sum + Number(c.remainingAmount || 0), 0);
  const totalLiability = totalRefundsOwed + totalUnappliedCredits;

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen pb-24">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/night-audit')} 
            className="rounded-full h-10 px-4 shadow-sm border-slate-200 text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-3 text-indigo-600 font-semibold mb-2 text-sm tracking-widest uppercase">
            Guest Ledger
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
            <Banknote className="w-8 h-8 text-indigo-600" />
            Accounts Payable & Credits
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Property liabilities including overpayments, refunds owed, and advance deposits.
          </p>
        </div>
        
        <div className="text-right">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Liability</div>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-black text-indigo-600`}>
                {formatCurrency(totalLiability, 'NGN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Folio Credit Balances
            </h3>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-sm">
              {formatCurrency(totalRefundsOwed, 'NGN')}
            </span>
          </div>
          <div className="p-0 overflow-x-auto min-h-[300px]">
            {negativeFolios.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <CheckCircle2 className="w-12 h-12 text-emerald-200 mb-4" />
                <h4 className="text-lg font-bold text-slate-800">No Credit Folios</h4>
                <p className="text-slate-500 mt-1 text-sm">No folios have negative balances.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    <th className="p-4">Folio</th>
                    <th className="p-4">Guest</th>
                    <th className="p-4 text-right">Credit Balance</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {negativeFolios.map((folio: any) => {
                    const name = folio.guest ? `${folio.guest.firstName} ${folio.guest.lastName}` : folio.corporateAccount?.name || 'Master Folio';
                    
                    return (
                      <tr key={folio.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 text-sm">{folio.folioNumber}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-sm">{name}</div>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-bold text-emerald-600">
                            {formatCurrency(Math.abs(Number(folio.balance)), 'NGN')}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <Button variant="outline" size="sm" className="bg-white" onClick={() => setViewingFolioId(folio.id)}>
                            View <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-slate-400" />
              Unapplied Advance Deposits
            </h3>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-sm">
              {formatCurrency(totalUnappliedCredits, 'NGN')}
            </span>
          </div>
          <div className="p-0 overflow-x-auto min-h-[300px]">
            {credits.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <CheckCircle2 className="w-12 h-12 text-emerald-200 mb-4" />
                <h4 className="text-lg font-bold text-slate-800">No Unused Deposits</h4>
                <p className="text-slate-500 mt-1 text-sm">All deposits have been applied to folios.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                    <th className="p-4">Method</th>
                    <th className="p-4">Guest</th>
                    <th className="p-4 text-right">Unapplied Amt</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {credits.map((credit: any) => {
                    const name = credit.folio?.guest ? `${credit.folio.guest.firstName} ${credit.folio.guest.lastName}` : credit.folio?.corporateAccount?.name || 'Master Folio';
                    
                    return (
                      <tr key={credit.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 text-sm">{credit.method}</div>
                          <div className="text-[10px] text-slate-500">{format(new Date(credit.businessDate), 'dd MMM yyyy')}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-sm">{name}</div>
                          <div className="text-xs text-slate-500">{credit.folio?.folioNumber}</div>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-sm">
                            {formatCurrency(Number(credit.remainingAmount), 'NGN')}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <Button variant="outline" size="sm" className="bg-white" onClick={() => setViewingFolioId(credit.folio?.id)}>
                            View Folio <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!viewingFolioId} onOpenChange={(open) => !open && setViewingFolioId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[1400px] max-w-[1400px] h-[90vh] p-0 overflow-y-auto">
          {viewingFolioId && <FolioDetailView folioId={viewingFolioId} onBack={() => setViewingFolioId(null)} readOnly={true} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
