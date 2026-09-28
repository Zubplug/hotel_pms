'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { goBack } from '@/lib/frontdesk-navigation';
import { ArrowLeft, CreditCard, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { FrontDeskCityLedgerPaymentDialog } from '@/components/frontdesk/FrontDeskCityLedgerPaymentDialog';
import { FrontDeskAddPaymentDialog } from '@/components/frontdesk/FrontDeskAddPaymentDialog';

function EventInvoicePaymentAction({ invoice, folioId, outstanding, onPaymentSuccess }: { invoice: any; folioId: string; outstanding: number; onPaymentSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const folio = {
    id: folioId,
    balance: outstanding,
    currency: invoice.currency || 'NGN',
    reservationId: invoice.reservationId,
    reservation: invoice.event?.guest ? { primaryGuest: invoice.event.guest } : undefined,
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">
        <CreditCard className="h-3.5 w-3.5" /> Receive payment
      </Button>
      <FrontDeskAddPaymentDialog
        open={open}
        onOpenChange={setOpen}
        folio={folio}
        initialAmount={outstanding}
        eventInvoiceId={invoice.id}
        onPaymentSuccess={onPaymentSuccess}
      />
    </>
  );
}

export default function FrontDeskEventInvoicesPage() {
  const { propertyId } = useProperty();
  const router = useRouter();
  const { provider, isOnline } = useLodgeCoreProvider();

  const { data: eventInvoicesData, isLoading: eventInvoicesLoading, refetch: refetchEventInvoices } = useQuery({
    queryKey: ['frontdesk', 'eventInvoices', propertyId, ''],
    queryFn: () => provider.eventInvoices.list(propertyId, ''),
    enabled: !!propertyId,
    refetchInterval: isOnline ? 30000 : false,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)] pb-24">
      {/* Premium command header */}
      <div className="relative overflow-hidden bg-[#09152d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-cyan-500/20 blur-[80px]" />
        <div className="pointer-events-none absolute bottom-[-130px] left-1/3 h-64 w-64 rounded-full bg-blue-400/10 blur-[70px]" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="mb-7 flex items-center gap-3">
            <button onClick={() => goBack(router, '/frontdesk')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Back to previous screen"><ArrowLeft className="h-4 w-4" /></button>
            <span className="text-xs font-semibold text-slate-500">Front Desk</span><span className="text-slate-700">/</span><span className="text-xs font-semibold text-cyan-300">Event Invoices</span>
          </div>
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-cyan-300"><span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/15"><ReceiptText className="h-3.5 w-3.5" /></span> Billing & Events</div>
              <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Event Invoices</h1>
              <p className="mt-2 text-sm text-slate-400">Track and settle outstanding event invoices.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
        {eventInvoicesLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-cyan-600 rounded-full animate-spin"></div>
          </div>
        ) : (() => {
          const rawInvoices: any[] = Array.isArray(eventInvoicesData) ? eventInvoicesData : ((eventInvoicesData as any)?.data ?? []);
          return rawInvoices.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <ReceiptText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900">No event invoices</h3>
              <p className="text-slate-500">Issued event invoices for this property will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Client</th>
                    <th className="px-5 py-4">Event</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Outstanding</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rawInvoices.map((invoice: any) => {
                    const outstanding = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0));
                    const folioId = invoice.folioId || invoice.folio?.id;
                    const clientName = invoice.clientName || (invoice.event?.guest ? `${invoice.event.guest.firstName || ''} ${invoice.event.guest.lastName || ''}`.trim() : invoice.event?.corporateAccount?.name || invoice.event?.contactName || '—');
                    const ledgerEntry = invoice.cityLedgerEntryId ? { entryId: invoice.cityLedgerEntryId, accountId: invoice.cityLedgerAccountId, accountType: 'CORPORATE', accountName: clientName, invoiceId: invoice.cityLedgerInvoiceId, outstandingAmount: outstanding, currency: invoice.currency } : null;
                    return (
                      <tr key={invoice.id}>
                        <td className="px-5 py-4 font-semibold text-slate-800">{clientName}</td>
                        <td className="px-5 py-4 text-slate-700">{invoice.eventName || invoice.event?.name || 'Event'}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${invoice.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : invoice.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                          {invoice.currency || 'NGN'} {outstanding.toLocaleString()}
                        </td>
                        <td className="px-5 py-4">
                          {folioId && outstanding > 0 ? (
                            <EventInvoicePaymentAction invoice={invoice} folioId={folioId} outstanding={outstanding} onPaymentSuccess={() => { void refetchEventInvoices(); }} />
                          ) : ledgerEntry && outstanding > 0 ? (
                            <FrontDeskCityLedgerPaymentDialog entry={ledgerEntry} onComplete={() => Promise.resolve(refetchEventInvoices())} />
                          ) : (
                            <span className="text-xs text-slate-400">{outstanding <= 0 ? 'Settled' : 'Payment route unavailable'}</span>
                          )}
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
