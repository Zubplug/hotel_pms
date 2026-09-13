'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Banknote, ChevronRight, FileText, CheckCircle2, Loader2, CreditCard } from 'lucide-react';
import { getAccountsPayable } from '@/lib/night-audit-actions';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FolioDetailView } from '@/components/finance/FolioDetailView';
import { format } from 'date-fns';

const PAGE_BG = { background: 'linear-gradient(160deg, #060b18 0%, #080e1f 60%, #0a0c22 100%)' };

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export default function AccountsPayableLedgerPage() {
  const { propertyId } = useProperty();
  const [viewingFolioId, setViewingFolioId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['night-audit', 'ap-ledger', propertyId],
    queryFn: () => getAccountsPayable(propertyId),
    enabled: !!propertyId,
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center" style={PAGE_BG}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-full px-5 pb-12 pt-8" style={PAGE_BG}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 text-sm text-rose-300">
        Failed to load Accounts Payable. Please try again.
      </div>
    </div>
  );

  const { negativeFolios, credits } = data as any;
  const totalRefundsOwed = negativeFolios.reduce((sum: number, f: any) => sum + Math.abs(Number(f.balance || 0)), 0);
  const totalUnappliedCredits = credits.reduce((sum: number, c: any) => sum + Number(c.remainingAmount || 0), 0);
  const totalLiability = totalRefundsOwed + totalUnappliedCredits;

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
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-400/25"
                style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.2),rgba(124,58,237,0.12))', boxShadow: '0 0 24px rgba(139,92,246,0.15)' }}
              >
                <Banknote className="h-5 w-5 text-violet-300" />
              </span>
              Accounts Payable & Credits
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Property liabilities: overpayments, refunds owed, and advance deposits.
            </p>
          </div>

          {/* Total liability hero */}
          <div className="flex flex-col items-end rounded-[20px] border border-violet-400/20 bg-violet-400/[0.07] px-6 py-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Liability</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-violet-300">{formatCurrency(totalLiability, 'NGN')}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              {negativeFolios.length} credit folio{negativeFolios.length !== 1 ? 's' : ''} · {credits.length} deposit{credits.length !== 1 ? 's' : ''}
            </p>
          </div>
        </header>

        {/* ── Sub-stat strip ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-4 rounded-[20px] border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
              <FileText className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Folio Credit Balances</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-white">{formatCurrency(totalRefundsOwed, 'NGN')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[20px] border border-sky-400/20 bg-sky-400/[0.06] px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-400">
              <CreditCard className="h-[18px] w-[18px]" />
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Unapplied Deposits</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-white">{formatCurrency(totalUnappliedCredits, 'NGN')}</p>
            </div>
          </div>
        </div>

        {/* ── Two-panel grid ── */}
        <div className="grid gap-5 lg:grid-cols-2">

          {/* Folio Credit Balances */}
          <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-white">Folio Credit Balances</h2>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                {formatCurrency(totalRefundsOwed, 'NGN')}
              </span>
            </div>

            {negativeFolios.length === 0 ? (
              <EmptyState title="No Credit Folios" sub="No folios have negative balances." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }} className="border-b border-white/[0.06]">
                      {['Folio', 'Guest', 'Credit Balance', ''].map((h, i) => (
                        <th key={i} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {negativeFolios.map((folio: any) => {
                      const name = folio.guest
                        ? `${folio.guest.firstName} ${folio.guest.lastName}`
                        : folio.corporateAccount?.name || 'Master Folio';
                      return (
                        <tr key={folio.id} className="group transition-colors hover:bg-white/[0.03]">
                          <td className="px-5 py-3.5 text-sm font-bold text-white">{folio.folioNumber}</td>
                          <td className="px-5 py-3.5 text-sm font-semibold text-slate-300">{name}</td>
                          <td className="px-5 py-3.5 text-right text-sm font-bold tabular-nums text-emerald-300">
                            {formatCurrency(Math.abs(Number(folio.balance)), 'NGN')}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setViewingFolioId(folio.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-indigo-300 opacity-0 transition-all hover:border-indigo-400/40 hover:bg-indigo-400/10 group-hover:opacity-100"
                            >
                              View <ChevronRight className="h-3 w-3" />
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

          {/* Unapplied Advance Deposits */}
          <div className="overflow-hidden rounded-[20px] border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-white">Unapplied Advance Deposits</h2>
              </div>
              <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-bold text-sky-300">
                {formatCurrency(totalUnappliedCredits, 'NGN')}
              </span>
            </div>

            {credits.length === 0 ? (
              <EmptyState title="No Unused Deposits" sub="All deposits have been applied to folios." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }} className="border-b border-white/[0.06]">
                      {['Method', 'Guest', 'Unapplied Amt', ''].map((h, i) => (
                        <th key={i} className={`px-5 py-3 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {credits.map((credit: any) => {
                      const name = credit.folio?.guest
                        ? `${credit.folio.guest.firstName} ${credit.folio.guest.lastName}`
                        : credit.folio?.corporateAccount?.name || 'Master Folio';
                      return (
                        <tr key={credit.id} className="group transition-colors hover:bg-white/[0.03]">
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-bold text-white">{credit.method}</p>
                            <p className="text-[10px] text-slate-600">{format(new Date(credit.businessDate), 'dd MMM yyyy')}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-300">{name}</p>
                            <p className="text-[10px] text-slate-600">{credit.folio?.folioNumber}</p>
                          </td>
                          <td className="px-5 py-3.5 text-right text-sm font-bold tabular-nums text-emerald-300">
                            {formatCurrency(Number(credit.remainingAmount), 'NGN')}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setViewingFolioId(credit.folio?.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-indigo-300 opacity-0 transition-all hover:border-indigo-400/40 hover:bg-indigo-400/10 group-hover:opacity-100"
                            >
                              View Folio <ChevronRight className="h-3 w-3" />
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
      </div>

      <Dialog open={!!viewingFolioId} onOpenChange={(open) => !open && setViewingFolioId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[1400px] max-w-[1400px] h-[90vh] p-0 overflow-y-auto">
          {viewingFolioId && <FolioDetailView folioId={viewingFolioId} onBack={() => setViewingFolioId(null)} readOnly={true} darkMode />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
