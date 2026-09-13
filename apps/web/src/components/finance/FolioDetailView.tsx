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
  }, [folioId, paymentOpen]);

  if (error) return (
    <div className="min-h-full px-6 py-8" style={{ background: '#07090f' }}>
      {onBack && (
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 text-sm text-rose-300">{error}</div>
    </div>
  );

  if (!folio) return (
    <div className="flex min-h-[300px] items-center justify-center" style={{ background: '#07090f' }}>
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  const guest = folio.guest ? `${folio.guest.firstName} ${folio.guest.lastName}`.trim() : 'Guest account';

  return (
    <div className="w-full max-w-none space-y-5" style={{ background: '#07090f', color: '#f1f5f9' }}>

      {/* ── Top action bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          {readOnly && (
            <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-400 sm:inline-flex">
              <LockKeyhole className="h-3.5 w-3.5" /> Read-only audit view
            </span>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          {!readOnly && (
            <button
              onClick={() => setPaymentOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-400/10 px-3.5 py-2 text-sm font-semibold text-indigo-300 transition-colors hover:bg-indigo-400/20 hover:text-indigo-200"
            >
              <CreditCard className="h-4 w-4" /> Record payment
            </button>
          )}
        </div>
      </div>

      {/* ── Hero section ── */}
      <section
        className="relative mx-6 overflow-hidden rounded-[24px] border border-white/[0.07] p-6 sm:p-8"
        style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.16) 0%,rgba(124,58,237,0.10) 100%)' }}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-violet-600/10 blur-2xl" />
        <div className="relative flex flex-wrap justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-400/80">
              <ReceiptText className="h-3.5 w-3.5" /> Guest Folio
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{guest}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Folio {folio.folioNumber}
              <span className="mx-1.5 text-slate-700">·</span>
              {folio.reservation?.confirmationNumber || 'No reservation'}
              <span className="mx-1.5 text-slate-700">·</span>
              Room {folio.reservation?.reservationRooms?.[0]?.room?.number || 'Unassigned'}
            </p>
          </div>
          <div className="min-w-[220px] rounded-2xl border border-white/[0.08] p-5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Outstanding balance</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-amber-300">
              {folio.currency} {folio.balance.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">{folio.status}</p>
          </div>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <div className="grid gap-3 px-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Total Charges</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-white">{folio.currency} {folio.totalCharges.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 p-5" style={{ background: 'rgba(16,185,129,0.07)' }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Payments Received</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-emerald-300">{folio.currency} {folio.totalPayments.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-sky-400/20 p-5" style={{ background: 'rgba(14,165,233,0.07)' }}>
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            <WalletCards className="h-3 w-3" /> Credit Balance
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-sky-300">{folio.currency} {Number(folio.availableCredit || 0).toLocaleString()}</p>
          <p className="mt-1 text-[10px] text-slate-600">Available for this stay</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Account Type</p>
          <p className="mt-2 flex items-center gap-2 text-xl font-bold text-white">
            <WalletCards className="h-5 w-5 text-indigo-400" /> Room folio
          </p>
        </div>
      </div>

      {/* ── Folio activity table ── */}
      <section className="mx-6 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div>
            <p className="text-sm font-bold text-white">Folio Activity</p>
            <p className="mt-0.5 text-xs text-slate-500">Charges and adjustments posted to this account</p>
          </div>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {folio.items.length} entries
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/[0.05]" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                {['Date', 'Description', 'Type', 'Amount'].map((h, i) => (
                  <th key={h} className={`p-4 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {folio.items.map((item: any) => (
                <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="p-4 whitespace-nowrap text-slate-400">{new Date(item.businessDate).toLocaleDateString()}</td>
                  <td className="p-4 text-slate-300">{item.description}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">
                      {item.type}
                    </span>
                  </td>
                  <td className={`p-4 text-right font-bold tabular-nums whitespace-nowrap ${Number(item.amount) < 0 ? 'text-emerald-300' : 'text-white'}`}>
                    {folio.currency} {Number(item.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
              {folio.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-sm text-slate-500">No charges recorded on this folio.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Payment history ── */}
      <section className="mx-6 mb-6 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div>
            <p className="text-sm font-bold text-white">Payment History</p>
            <p className="mt-0.5 text-xs text-slate-500">Verified collections applied to this folio</p>
          </div>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            {folio.payments.length} payments
          </span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {folio.payments.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">No payments recorded.</p>
          ) : (
            folio.payments.map((payment: any) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 p-5 text-sm transition-colors hover:bg-white/[0.02]">
                <div>
                  <p className="font-semibold text-slate-200">
                    {payment.method.replace(/_/g, ' ')}
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className={payment.status === 'SUCCESS' ? 'text-emerald-300' : 'text-slate-500'}>{payment.status}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(payment.createdAt).toLocaleString()} · {payment.collectionSource.replace(/_/g, ' ')}
                  </p>
                </div>
                <strong className="whitespace-nowrap text-base font-bold tabular-nums text-emerald-300">
                  {payment.currency} {Number(payment.amount).toLocaleString()}
                </strong>
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
