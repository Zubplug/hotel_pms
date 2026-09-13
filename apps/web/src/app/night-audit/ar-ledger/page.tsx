'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useProperty } from '@/components/PropertyProvider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wallet, AlertTriangle, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import { getAccountsReceivable } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

export default function AccountsReceivableLedgerPage() {
  const router = useRouter();
  const { propertyId } = useProperty();
  const [viewingFolioId, setViewingFolioId] = useState<string | null>(null);

  const { data: folios, isLoading, error } = useQuery({
    queryKey: ['night-audit', 'ar-ledger', propertyId],
    queryFn: () => getAccountsReceivable(propertyId),
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

  if (error || !folios) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200">
          Failed to load Accounts Receivable. Please try again.
        </div>
      </div>
    );
  }

  const totalOutstanding = folios.reduce((sum, f) => sum + Number(f.balance || 0), 0);

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
            <Wallet className="w-8 h-8 text-indigo-600" />
            Accounts Receivable
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Outstanding guest balances owed to the property.
          </p>
        </div>
        
        <div className="text-right">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Outstanding</div>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-black text-amber-600`}>
                {formatCurrency(totalOutstanding, 'NGN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            {folios.length} Outstanding Folios
          </h3>
        </div>
        <div className="p-0 overflow-x-auto">
          {folios.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-200 mb-4" />
              <h4 className="text-lg font-bold text-slate-800">No Outstanding Balances</h4>
              <p className="text-slate-500 mt-1">All guests have settled their accounts.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="p-4">Folio</th>
                  <th className="p-4">Guest / Corporate</th>
                  <th className="p-4">Room</th>
                  <th className="p-4 text-right">Balance Due</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {folios.map((folio: any) => {
                  const name = folio.guest ? `${folio.guest.firstName} ${folio.guest.lastName}` : folio.corporateAccount?.name || 'Master Folio';
                  const roomNumber = folio.reservation?.reservationRooms?.[0]?.room?.number || 'N/A';
                  
                  return (
                    <tr key={folio.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{folio.folioNumber}</div>
                        <div className="text-xs text-slate-500">{folio.type}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{name}</div>
                      </td>
                      <td className="p-4 text-slate-600 font-medium">
                        {roomNumber}
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                          {formatCurrency(Number(folio.balance), 'NGN')}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <Button variant="outline" size="sm" className="bg-white" onClick={() => setViewingFolioId(folio.id)}>
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

      <Dialog open={!!viewingFolioId} onOpenChange={(open) => !open && setViewingFolioId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[1400px] max-w-[1400px] h-[90vh] p-0 overflow-y-auto">
          {viewingFolioId && <FolioDetailView folioId={viewingFolioId} onBack={() => setViewingFolioId(null)} readOnly={true} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
