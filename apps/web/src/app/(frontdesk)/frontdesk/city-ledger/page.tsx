'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { goBack } from '@/lib/frontdesk-navigation';
import { ArrowLeft, Landmark, Sparkles } from 'lucide-react';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { FrontDeskCityLedgerPaymentDialog } from '@/components/frontdesk/FrontDeskCityLedgerPaymentDialog';
import { GuestCreditRefundDialog } from '@/components/accountant/GuestCreditRefundDialog';

export default function FrontDeskCityLedgerPage() {
  const { propertyId } = useProperty();
  const router = useRouter();
  const { provider, isOnline } = useLodgeCoreProvider();

  const { data: cityLedgerData, isLoading: cityLedgerLoading, refetch: refetchCityLedger } = useQuery({
    queryKey: ['frontdesk', 'cityLedger', propertyId],
    queryFn: () => provider.cityLedger.list(propertyId),
    enabled: !!propertyId,
    refetchInterval: isOnline ? 30000 : false,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)] pb-24">
      {/* Premium command header */}
      <div className="relative overflow-hidden bg-[#09152d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-[-130px] left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-[70px]" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="mb-7 flex items-center gap-3">
            <button onClick={() => goBack(router, '/frontdesk')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Back to previous screen"><ArrowLeft className="h-4 w-4" /></button>
            <span className="text-xs font-semibold text-slate-500">Front Desk</span><span className="text-slate-700">/</span><span className="text-xs font-semibold text-indigo-300">City Ledger</span>
          </div>
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-300/20 bg-indigo-400/15"><Landmark className="h-3.5 w-3.5" /></span> Accounts Receivable</div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">City Ledger</h1>
              <p className="mt-2 text-sm text-slate-400">Manage offline Skipper/Walkout balances, corporate advances, and account ledgers.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
        {cityLedgerLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (() => {
          const rawEntries: any[] = Array.isArray(cityLedgerData) ? cityLedgerData : ((cityLedgerData as any)?.data ?? []);
          const entries = Object.values(rawEntries.reduce((groups: Record<string, any>, entry: any) => {
            if (entry.accountType !== 'CORPORATE') {
              groups[`walkout:${entry.entryId}`] = entry;
              return groups;
            }
            // Keep one professional row per corporate account. The row can
            // still carry both actions: invoice payment and new advance.
            const key = `corporate:${entry.accountId}`;
            const isAdvance = entry.entryKind === 'CORPORATE_ADVANCE';
            const current = groups[key];
            if (!current) {
              groups[key] = {
                ...entry,
                entryKind: 'CORPORATE_ACCOUNT',
                invoiceNumber: 'Account balance',
                ledgerEntry: isAdvance ? null : entry,
                advanceEntry: isAdvance ? entry : null,
                ledgerAmount: isAdvance ? 0 : Number(entry.amount || 0),
                ledgerOutstandingAmount: isAdvance ? 0 : Number(entry.outstandingAmount || 0),
                advanceAmount: isAdvance ? Number(entry.amount || 0) : 0,
                advanceOutstandingAmount: isAdvance ? Number(entry.outstandingAmount || 0) : 0,
              };
              return groups;
            }
            current.amount = Number(current.amount || 0) + Number(entry.amount || 0);
            current.paidAmount = Number(current.paidAmount || 0) + Number(entry.paidAmount || 0);
            current.status = current.status === 'PENDING_SETTLEMENT' || entry.status === 'PENDING_SETTLEMENT' ? 'PENDING_SETTLEMENT' : current.status;
            if (isAdvance) {
              current.advanceEntry = current.advanceEntry?.entryId ? current.advanceEntry : entry;
              current.advanceAmount += Number(entry.amount || 0);
              current.advanceOutstandingAmount += Number(entry.outstandingAmount || 0);
            } else {
              current.ledgerEntry = current.ledgerEntry || entry;
              current.ledgerAmount += Number(entry.amount || 0);
              current.ledgerOutstandingAmount += Number(entry.outstandingAmount || 0);
            }
            current.outstandingAmount = current.ledgerOutstandingAmount || current.advanceOutstandingAmount;
            return groups;
          }, {}));
          return entries.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900">No open city-ledger balances</h3>
              <p className="text-slate-500">Skipper/walkout invoices, corporate balances, and unapplied corporate advances will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Ledger</th>
                    <th className="px-5 py-4">Guest / organisation</th>
                    <th className="px-5 py-4">Reference</th>
                    <th className="px-5 py-4 text-right">Outstanding</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry: any) => {
                    const isCorporate = entry.accountType === 'CORPORATE';
                    const ledgerEntry = isCorporate && entry.ledgerEntry
                      ? { ...entry.ledgerEntry, amount: entry.ledgerAmount, outstandingAmount: entry.ledgerOutstandingAmount }
                      : null;
                    const advanceEntry = isCorporate && entry.advanceEntry
                      ? { ...entry.advanceEntry, amount: entry.advanceAmount, outstandingAmount: entry.advanceOutstandingAmount }
                      : null;
                    return (
                    <tr key={isCorporate ? `corporate:${entry.accountId}` : entry.entryId}>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${isCorporate ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isCorporate ? 'Corporate account' : 'Skipper / Walkout'}
                        </span>
                        <div className="mt-2 text-xs text-slate-500">{entry.accountName}</div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-800">
                        {isCorporate ? entry.accountName : (entry.guestName || '—')}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">
                        {entry.invoiceNumber || entry.entryId?.slice(0, 8)}
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                        {isCorporate && ledgerEntry && advanceEntry && Number(advanceEntry.outstandingAmount) > 0 ? (
                          <div>
                            <div>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: entry.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(ledgerEntry.outstandingAmount))}</div>
                            <div className="mt-1 text-xs font-semibold text-emerald-600">Advance: {new Intl.NumberFormat('en-NG', { style: 'currency', currency: entry.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(advanceEntry.outstandingAmount))}</div>
                          </div>
                        ) : new Intl.NumberFormat('en-NG', { style: 'currency', currency: entry.currency || 'NGN', maximumFractionDigits: 0 }).format(Number(entry.outstandingAmount))}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {isCorporate && ledgerEntry && <FrontDeskCityLedgerPaymentDialog entry={ledgerEntry} onComplete={refetchCityLedger} />}
                          {isCorporate && advanceEntry && <FrontDeskCityLedgerPaymentDialog entry={advanceEntry} onComplete={refetchCityLedger} />}
                          {isCorporate && advanceEntry?.entryId && Number(advanceEntry.outstandingAmount) > 0 && <GuestCreditRefundDialog entryId={advanceEntry.entryId} guestName={entry.accountName} amount={Number(advanceEntry.outstandingAmount)} currency={entry.currency || 'NGN'} propertyId={propertyId} accountType="CORPORATE_ADVANCE" />}
                          {!isCorporate && <FrontDeskCityLedgerPaymentDialog entry={entry} onComplete={refetchCityLedger} />}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
