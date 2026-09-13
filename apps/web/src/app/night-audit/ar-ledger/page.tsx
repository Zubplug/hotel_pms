'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Wallet, ChevronRight, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { getAccountsReceivable } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

const PAGE_BG = { background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' };

export default function AccountsReceivableLedgerPage() {
  const { propertyId } = useProperty();
  const [viewingFolioId, setViewingFolioId] = useState<string | null>(null);

  const { data: folios, isLoading, error } = useQuery({
    queryKey: ['night-audit', 'ar-ledger', propertyId],
    queryFn: () => getAccountsReceivable(propertyId),
    enabled: !!propertyId,
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center" style={PAGE_BG}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error || !folios) return (
    <div className="min-h-full px-5 pb-12 pt-8" style={PAGE_BG}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 text-sm text-rose-300">
        Failed to load Accounts Receivable. Please try again.
      </div>
    </div>
  );

  const totalOutstanding = folios.reduce((sum: number, f: any) => sum + Number(f.balance || 0), 0);

  return (
    <div className="min-h-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8 md:px-8" style={PAGE_BG}>
      <div className="mx-auto max-w-[1540px] space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Night Audit / Ledgers
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-400/25"
                style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(217,119,6,0.12))', boxShadow: '0 0 24px rgba(245,158,11,0.15)' }}
              >
                <Wallet className="h-5 w-5 text-amber-300" />
              </span>
              Accounts Receivable
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Outstanding guest balances owed to the property.
            </p>
          </div>

          {/* Total hero */}
          <div className="flex flex-col items-end rounded-[20px] border border-amber-400/20 bg-amber-400/[0.07] px-6 py-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Outstanding</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-amber-300">{formatCurrency(totalOutstanding, 'NGN')}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              {folios.length} open folio{folios.length !== 1 ? 's' : ''}
            </p>
          </div>
        </header>

        {/* ── Table card ── */}
        <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
            <FileText className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-bold text-white">
              {folios.length} Outstanding Folio{folios.length !== 1 ? 's' : ''}
            </h2>
          </div>

          {folios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-sm font-bold text-white">No Outstanding Balances</h3>
              <p className="mt-1 text-xs text-slate-500">All guests have settled their accounts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }} className="border-b border-white/[0.06]">
                    {['Folio', 'Guest / Corporate', 'Room', 'Balance Due', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i >= 3 ? 'text-right' : 'text-left'}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {folios.map((folio: any) => {
                    const name = folio.guest
                      ? `${folio.guest.firstName} ${folio.guest.lastName}`
                      : folio.corporateAccount?.name || 'Master Folio';
                    const roomNumber = folio.reservation?.reservationRooms?.[0]?.room?.number || 'N/A';
                    return (
                      <tr key={folio.id} className="group transition-colors hover:bg-white/[0.03]">
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-white">{folio.folioNumber}</p>
                          <p className="mt-0.5 text-[10px] text-slate-600">{folio.type}</p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                            >
                              {name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-slate-200">{name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-lg border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-xs font-bold text-slate-300">
                            {roomNumber}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-sm font-bold tabular-nums text-amber-300">
                            {formatCurrency(Number(folio.balance), 'NGN')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setViewingFolioId(folio.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-indigo-300 opacity-0 transition-all hover:border-indigo-400/40 hover:bg-indigo-400/10 group-hover:opacity-100"
                          >
                            View Folio
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!viewingFolioId} onOpenChange={(open) => !open && setViewingFolioId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[1400px] max-w-[1400px] h-[90vh] p-0 overflow-y-auto">
          {viewingFolioId && <FolioDetailView folioId={viewingFolioId} onBack={() => setViewingFolioId(null)} readOnly={true} darkMode />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
