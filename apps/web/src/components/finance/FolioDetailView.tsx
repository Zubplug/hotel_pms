'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Loader2, Printer, LockKeyhole, WalletCards, ReceiptText } from 'lucide-react';
import { AddPaymentDialog } from '@/components/reservations/AddPaymentDialog';

export function FolioDetailView({ folioId, onBack, readOnly = false }: { folioId: string, onBack?: () => void, readOnly?: boolean }) {
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
    <div className="w-full max-w-none space-y-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />Back
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          {readOnly && <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 sm:inline-flex"><LockKeyhole className="h-3.5 w-3.5" /> Read-only audit view</span>}
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            <Printer className="h-4 w-4" />Print
          </button>
          {!readOnly && (
            <button onClick={() => setPaymentOpen(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-semibold text-white transition-colors shadow-sm">
              <CreditCard className="h-4 w-4" />Record payment
            </button>
          )}
        </div>
      </div>
      <section className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-[0_18px_45px_rgba(15,23,42,0.2)] sm:p-8">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex flex-wrap justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300"><ReceiptText className="h-4 w-4" /> Guest folio</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{guest}</h1>
            <p className="mt-3 break-words text-sm text-slate-400">Folio {folio.folioNumber} <span className="mx-1 text-slate-600">·</span> {folio.reservation?.confirmationNumber || 'No reservation'} <span className="mx-1 text-slate-600">·</span> Room {folio.reservation?.reservationRooms?.[0]?.room?.number || 'Unassigned'}</p>
          </div>
          <div className="min-w-[210px] rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Outstanding balance</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-amber-300">{folio.currency} {folio.balance.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">{folio.status}</p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total charges</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{folio.currency} {folio.totalCharges.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payments received</p>
          <p className="mt-2 text-xl font-bold text-emerald-600">{folio.currency} {folio.totalPayments.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700"><WalletCards className="h-4 w-4" /> Credit balance wallet</p>
          <p className="mt-2 text-xl font-bold text-blue-700">{folio.currency} {Number(folio.availableCredit || 0).toLocaleString()}</p>
          <p className="mt-1 text-xs text-blue-600/70">Available for this stay</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account type</p>
          <p className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-900"><WalletCards className="h-5 w-5 text-indigo-500" /> Room folio</p>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4"><div><p className="font-semibold text-slate-900">Folio activity</p><p className="mt-0.5 text-xs text-slate-500">Charges and adjustments posted to this account</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{folio.items.length} entries</span></div>
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
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4"><div><p className="font-semibold text-slate-900">Payment history</p><p className="mt-0.5 text-xs text-slate-500">Verified collections applied to this folio</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">{folio.payments.length} payments</span></div>
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
      {!readOnly && (
        <AddPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          folio={{ id: folio.id, balance: folio.balance, currency: folio.currency, reservationId: folio.reservation?.id }}
          collectionSource="RECEIVABLES"
        />
      )}
    </div>
  );
}
