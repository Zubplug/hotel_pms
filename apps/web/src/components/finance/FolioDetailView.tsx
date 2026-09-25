'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, Loader2, Printer, LockKeyhole, WalletCards, ReceiptText } from 'lucide-react';
import { AddPaymentDialog } from '@/components/reservations/AddPaymentDialog';
import { FrontDeskAddPaymentDialog } from '@/components/frontdesk/FrontDeskAddPaymentDialog';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface FolioDetailViewProps {
  folioId: string;
  onBack?: () => void;
  readOnly?: boolean;
  /** Set to true when rendered inside the Night Audit module */
  darkMode?: boolean;
  eventInvoiceId?: string;
}

export function FolioDetailView({ folioId, onBack, readOnly = false, darkMode = false, eventInvoiceId }: FolioDetailViewProps) {
  const [folio, setFolio] = useState<any>(null);
  const [error, setError] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { provider, isDesktopMode } = useLodgeCoreProvider();

  useEffect(() => {
    let cancelled = false;
    void provider.folios.get(folioId).then((result: any) => {
      if (!cancelled) setFolio(result?.data || result);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load folio');
    });
    return () => { cancelled = true; };
  }, [folioId, paymentOpen, provider]);

  /* ── Error state ── */
  if (error) {
    if (darkMode) return (
      <div className="min-h-full px-6 py-8" style={{ background: '#07090f' }}>
        {onBack && (
          <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] p-5 text-sm text-rose-300">{error}</div>
      </div>
    );
    return (
      <div className="p-6">
        {onBack && <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-indigo-700"><ArrowLeft className="h-4 w-4" />Back</button>}
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</div>
      </div>
    );
  }

  /* ── Loading state ── */
  if (!folio) {
    if (darkMode) return (
      <div className="flex min-h-[300px] items-center justify-center" style={{ background: '#07090f' }}>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
    return <div className="flex justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  const guest = folio.guest ? `${folio.guest.firstName} ${folio.guest.lastName}`.trim() : 'Guest account';

  /* ══════════════════════════════════════════════════════════════════
     DARK MODE (Night Audit)
  ══════════════════════════════════════════════════════════════════ */
  if (darkMode) {
    return (
      <div className="w-full max-w-none space-y-5" style={{ background: '#07090f', color: '#f1f5f9' }}>

        {/* Top action bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
          {onBack ? (
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-indigo-400 transition-colors hover:text-indigo-300">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            {readOnly && (
              <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-400 sm:inline-flex">
                <LockKeyhole className="h-3.5 w-3.5" /> Read-only audit view
              </span>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white">
              <Printer className="h-4 w-4" /> Print
            </button>
            {!readOnly && (
              <button onClick={() => setPaymentOpen(true)} className="flex items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-400/10 px-3.5 py-2 text-sm font-semibold text-indigo-300 transition-colors hover:bg-indigo-400/20">
                <CreditCard className="h-4 w-4" /> Record payment
              </button>
            )}
          </div>
        </div>

        {/* Hero */}
        <section className="relative mx-6 overflow-hidden rounded-[24px] border border-white/[0.07] p-6 sm:p-8"
          style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.16) 0%,rgba(124,58,237,0.10) 100%)' }}>
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
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
              <p className="mt-2 text-3xl font-bold tabular-nums text-amber-300">{folio.currency} {folio.balance.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-slate-600">{folio.status}</p>
            </div>
          </div>
        </section>

        {/* Stat cards */}
        <div className="grid gap-3 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Charges', value: `${folio.currency} ${folio.totalCharges.toLocaleString()}`, cls: 'border-white/[0.06]', valCls: 'text-white', bg: 'rgba(255,255,255,0.03)' },
            { label: 'Payments Received', value: `${folio.currency} ${folio.totalPayments.toLocaleString()}`, cls: 'border-emerald-400/20', valCls: 'text-emerald-300', bg: 'rgba(16,185,129,0.07)' },
            { label: 'Credit Balance', value: `${folio.currency} ${Number(folio.availableCredit || 0).toLocaleString()}`, cls: 'border-sky-400/20', valCls: 'text-sky-300', bg: 'rgba(14,165,233,0.07)' },
            { label: 'Account Type', value: 'Room Folio', cls: 'border-white/[0.06]', valCls: 'text-white', bg: 'rgba(255,255,255,0.03)' },
          ].map(({ label, value, cls, valCls, bg }) => (
            <div key={label} className={`rounded-2xl border p-5 ${cls}`} style={{ background: bg }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
              <p className={`mt-2 text-xl font-bold tabular-nums ${valCls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Activity table */}
        <section className="mx-6 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div>
              <p className="text-sm font-bold text-white">Folio Activity</p>
              <p className="mt-0.5 text-xs text-slate-500">Charges and adjustments posted to this account</p>
            </div>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{folio.items.length} entries</span>
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
                      <span className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">{item.type}</span>
                    </td>
                    <td className={`p-4 text-right font-bold tabular-nums whitespace-nowrap ${Number(item.amount) < 0 ? 'text-emerald-300' : 'text-white'}`}>
                      {folio.currency} {Number(item.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {folio.items.length === 0 && (
                  <tr><td colSpan={4} className="p-10 text-center text-sm text-slate-500">No charges recorded on this folio.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payment history */}
        <section className="mx-6 mb-6 overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.025)' }}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div>
              <p className="text-sm font-bold text-white">Payment History</p>
              <p className="mt-0.5 text-xs text-slate-500">Verified collections applied to this folio</p>
            </div>
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">{folio.payments.length} payments</span>
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
                    <p className="mt-1 text-xs text-slate-500">{new Date(payment.createdAt).toLocaleString()} · {payment.collectionSource.replace(/_/g, ' ')}</p>
                  </div>
                  <strong className="whitespace-nowrap text-base font-bold tabular-nums text-emerald-300">{payment.currency} {Number(payment.amount).toLocaleString()}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        {!readOnly && isDesktopMode && (
          <FrontDeskAddPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen}
            folio={folio}
            eventInvoiceId={eventInvoiceId}
            mode="payment"
          />
        )}
        {!readOnly && !isDesktopMode && (
          <AddPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen}
            folio={{ id: folio.id, balance: folio.balance, currency: folio.currency, reservationId: folio.reservation?.id }}
            eventInvoiceId={eventInvoiceId}
            collectionSource="RECEIVABLES"
          />
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════
     LIGHT MODE (Frontdesk / Cashier — original design preserved)
  ══════════════════════════════════════════════════════════════════ */
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
              <tr><th className="p-4 font-semibold">Date</th><th className="p-4 font-semibold">Description</th><th className="p-4 font-semibold">Type</th><th className="p-4 text-right font-semibold">Amount</th></tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {folio.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 whitespace-nowrap">{new Date(item.businessDate).toLocaleDateString()}</td>
                  <td className="p-4">{item.description}</td>
                  <td className="p-4 whitespace-nowrap"><span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">{item.type}</span></td>
                  <td className={`p-4 text-right font-medium whitespace-nowrap ${Number(item.amount) < 0 ? 'text-emerald-600' : ''}`}>{folio.currency} {Number(item.amount).toLocaleString()}</td>
                </tr>
              ))}
              {folio.items.length === 0 && (<tr><td colSpan={4} className="p-8 text-center text-slate-500">No charges recorded on this folio.</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4"><div><p className="font-semibold text-slate-900">Payment history</p><p className="mt-0.5 text-xs text-slate-500">Verified collections applied to this folio</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">{folio.payments.length} payments</span></div>
        <div className="divide-y">
          {folio.payments.length === 0 ? (<p className="p-8 text-center text-sm text-slate-500">No payments recorded.</p>) : (
            folio.payments.map((payment: any) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 p-5 text-sm hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="font-medium text-slate-900">{payment.method.replace(/_/g, ' ')} &middot; <span className={payment.status === 'SUCCESS' ? 'text-emerald-600' : 'text-slate-600'}>{payment.status}</span></p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(payment.createdAt).toLocaleString()} &middot; {payment.collectionSource.replace(/_/g, ' ')}</p>
                </div>
                <strong className="text-emerald-600 whitespace-nowrap text-base">{payment.currency} {Number(payment.amount).toLocaleString()}</strong>
              </div>
            ))
          )}
        </div>
      </section>
      {!readOnly && isDesktopMode && (
        <FrontDeskAddPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen}
          folio={folio}
          eventInvoiceId={eventInvoiceId}
          mode="payment"
        />
      )}
      {!readOnly && !isDesktopMode && (
        <AddPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen}
          folio={{ id: folio.id, balance: folio.balance, currency: folio.currency, reservationId: folio.reservation?.id }}
          eventInvoiceId={eventInvoiceId}
          collectionSource="RECEIVABLES"
        />
      )}
    </div>
  );
}
