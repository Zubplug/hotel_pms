'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Loader2, Printer } from 'lucide-react';
import { AddPaymentDialog } from '@/components/reservations/AddPaymentDialog';

export function FolioDetailView({ folioId, onBack }: { folioId: string, onBack?: () => void }) {
  const [folio, setFolio] = useState<any>(null);
  const [error, setError] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    void fetch(`/api/v1/folios/${folioId}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load folio');
      setFolio(body.data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load folio'));
  }, [folioId, paymentOpen]); // Refresh when payment modal closes

  if (error) return <div className="p-6">{onBack && <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-indigo-700"><ArrowLeft className="h-4 w-4" />Back</button>}<div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</div></div>;
  if (!folio) return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  
  const guest = folio.guest ? `${folio.guest.firstName} ${folio.guest.lastName}`.trim() : 'Guest account';
  
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        ) : <div />}
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
            <Printer className="h-4 w-4" />Print
          </button>
          <button onClick={() => setPaymentOpen(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-semibold text-white transition-colors shadow-sm">
            <CreditCard className="h-4 w-4" />Record payment
          </button>
        </div>
      </div>
      <section className="rounded-2xl bg-slate-950 p-6 text-white shadow-md">
        <div className="flex flex-wrap justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-indigo-300 font-semibold">Guest folio</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">{guest}</h1>
            <p className="mt-2 text-sm text-slate-400">Folio {folio.folioNumber} &middot; {folio.reservation?.confirmationNumber || 'No reservation'} &middot; Room {folio.reservation?.reservationRooms?.[0]?.room?.number || 'Unassigned'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Outstanding balance</p>
            <p className="mt-1 text-3xl font-bold text-amber-400 tracking-tight">{folio.currency} {folio.balance.toLocaleString()}</p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total charges</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{folio.currency} {folio.totalCharges.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payments received</p>
          <p className="mt-2 text-xl font-bold text-emerald-600">{folio.currency} {folio.totalPayments.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{folio.status}</p>
        </div>
      </div>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50/50 px-5 py-4 font-semibold text-slate-900">Folio activity</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b">
              <tr>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold">Description</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {folio.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 whitespace-nowrap">{new Date(item.businessDate).toLocaleDateString()}</td>
                  <td className="p-4">{item.description}</td>
                  <td className="p-4 whitespace-nowrap"><span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">{item.type}</span></td>
                  <td className={`p-4 text-right font-medium whitespace-nowrap ${Number(item.amount) < 0 ? 'text-emerald-600' : ''}`}>
                    {folio.currency} {Number(item.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
              {folio.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">No charges recorded on this folio.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50/50 px-5 py-4 font-semibold text-slate-900">Payment history</div>
        <div className="divide-y">
          {folio.payments.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No payments recorded.</p>
          ) : (
            folio.payments.map((payment: any) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 p-5 text-sm hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900">{payment.method.replace(/_/g, ' ')} &middot; <span className={payment.status === 'SUCCESS' ? 'text-emerald-600' : 'text-slate-600'}>{payment.status}</span></p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(payment.createdAt).toLocaleString()} &middot; {payment.collectionSource.replace(/_/g, ' ')}
                  </p>
                </div>
                <strong className="text-emerald-600 whitespace-nowrap text-base">{payment.currency} {Number(payment.amount).toLocaleString()}</strong>
              </div>
            ))
          )}
        </div>
      </section>
      <AddPaymentDialog 
        open={paymentOpen} 
        onOpenChange={setPaymentOpen} 
        folio={{ id: folio.id, balance: folio.balance, currency: folio.currency, reservationId: folio.reservation?.id }} 
        collectionSource="RECEIVABLES" 
      />
    </div>
  );
}
