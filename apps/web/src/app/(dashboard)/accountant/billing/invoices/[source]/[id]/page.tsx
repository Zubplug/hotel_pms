/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { ArrowLeft, ExternalLink, FileText, History, LockKeyhole, ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BillingPrintButton } from '@/components/accountant/BillingPrintButton';
import { BILLING_SOURCES, getBillingDocumentPresentation, getBillingScope } from '@/lib/services/billing-read-model';

export const dynamic = 'force-dynamic';

export default async function BillingDocumentPage({ params }: { params: Promise<{ source: string; id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const route = await params;
  const source = route.source.toUpperCase();
  if (!BILLING_SOURCES.includes(source as typeof BILLING_SOURCES[number]) || !session.user.propertyId) return <Unavailable text="The requested source document is invalid." />;

  try {
    const scope = await getBillingScope(session.user.id, session.user.propertyId);
    const presentation = await getBillingDocumentPresentation(scope, source as typeof BILLING_SOURCES[number], route.id);
    if (!presentation) return <Unavailable text="The source document does not exist in this property scope." />;
    return <DocumentView presentation={presentation} />;
  } catch {
    return <Unavailable text="The source document is unavailable in the current property scope." />;
  }
}

function DocumentView({ presentation }: { presentation: Awaited<ReturnType<typeof getBillingDocumentPresentation>> }) {
  if (!presentation) return null;
  const { document, property, customer, items, context, history } = presentation;
  const isFolio = document.source === 'FOLIO';
  const generatedAt = new Date().toISOString();

  return (
    <main className="min-h-full bg-[#07111f] p-4 text-slate-100 sm:p-6 lg:p-8 print:bg-white print:p-0 print:text-slate-900">
      <div className="mx-auto max-w-[1180px] space-y-5 print:max-w-none print:space-y-0">
        <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/accountant/billing/invoices" className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
            <ArrowLeft className="h-3.5 w-3.5" /> Invoice register
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-slate-400"><LockKeyhole className="h-3.5 w-3.5" /> Read-only</span>
            <BillingPrintButton />
          </div>
        </header>

        <article className="billing-print-document overflow-hidden rounded-[24px] border border-white/10 bg-white/[.035] shadow-[0_24px_80px_rgba(0,0,0,.18)] print:rounded-none print:border-0 print:bg-white print:shadow-none">
          <div className="hidden border-b-2 border-slate-900 px-8 py-6 print:block print:px-0">
            <div className="flex items-start justify-between gap-8">
              <Brand property={property} print />
              <div className="text-right text-xs text-slate-600"><p className="font-bold uppercase tracking-wider">{isFolio ? 'Guest folio' : 'Financial invoice'}</p><p className="mt-1">Generated {formatDateTime(generatedAt)}</p></div>
            </div>
          </div>

          <section className="border-b border-white/[.08] bg-gradient-to-br from-cyan-400/[.13] via-white/[.03] to-violet-400/[.08] px-5 py-6 sm:px-8 sm:py-8 print:border-b print:border-slate-300 print:bg-white print:px-0 print:py-6">
            <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
              <div><Brand property={property} /><p className="mt-6 text-[10px] font-bold uppercase tracking-[.24em] text-cyan-300 print:text-slate-500">{isFolio ? 'Guest folio statement' : 'Commercial billing document'}</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white print:text-slate-900 sm:text-4xl">{document.reference}</h1><p className="mt-2 max-w-xl text-sm text-slate-400 print:text-slate-600">{document.description}</p></div>
              <div className="min-w-[220px] sm:text-right"><Status status={document.settlementStatus} /><p className="mt-3 text-xs text-slate-500">{document.source.replaceAll('_', ' ')} · Issued {formatDate(document.issueDate)}</p><p className="mt-1 text-xs text-slate-500">{document.dueDate ? `Due ${formatDate(document.dueDate)}` : 'No due date recorded'}</p></div>
            </div>
          </section>

          <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8 print:px-0 print:py-6">
            <section className="grid gap-5 rounded-2xl border border-white/[.08] bg-black/10 p-5 sm:grid-cols-3 print:rounded-none print:border print:border-slate-300 print:bg-white print:p-4">
              <InfoBlock label="Billed to"><p className="font-semibold text-white print:text-slate-900">{customer.name}</p><p>{customer.kind}</p>{customer.email && <p>{customer.email}</p>}{customer.phone && <p>{customer.phone}</p>}{customer.address && <p>{customer.address}</p>}</InfoBlock>
              <InfoBlock label={context.guestName ? 'Guest / stay' : isFolio || context.roomNumbers.length ? 'Stay details' : 'Document dates'}>{context.guestName && <p className="text-base font-semibold text-white print:text-slate-900">{context.guestName}</p>}{context.confirmationNumber ? <p>Confirmation {context.confirmationNumber}</p> : !context.guestName && <p>{document.source.replaceAll('_', ' ')}</p>}{context.checkIn && <p>Check-in {formatDate(context.checkIn)}</p>}{context.checkOut && <p>Check-out {formatDate(context.checkOut)}</p>}{context.roomNumbers.length > 0 && <p className="font-medium text-slate-200 print:text-slate-800">Room {context.roomNumbers.join(', ')}</p>}{context.eventName && <p>Event {context.eventName}</p>}</InfoBlock>
              <InfoBlock label="Document control"><p>Source ID <span className="break-all font-mono text-[11px]">{document.sourceId}</span></p><p>Currency {document.currency}</p><p>Balance: {document.balanceAuthority.replaceAll('_', ' ').toLowerCase()}</p><p className="print:hidden">Property scope verified server-side</p></InfoBlock>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/[.08] print:rounded-none print:border-slate-300">
              <div className="border-b border-white/[.08] px-5 py-4 print:border-slate-300 print:px-4"><h2 className="font-semibold text-white print:text-slate-900">{isFolio ? 'Folio activity' : 'Line items'}</h2><p className="mt-1 text-xs text-slate-500">{isFolio ? 'Chronological activity from the authoritative folio ledger.' : 'Items read from the authoritative source document.'}</p></div>
              <table className="w-full text-left text-sm"><thead className="table-header-group bg-white/[.03] text-[10px] uppercase tracking-wider text-slate-500 print:bg-slate-100"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-white/[.07] print:divide-slate-200">{items.map(item => <tr key={item.id} className="break-inside-avoid"><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400 print:text-slate-600">{formatDate(item.date)}</td><td className="px-4 py-3 text-slate-200 print:text-slate-800">{item.description}</td><td className="px-4 py-3 text-xs text-slate-400 print:text-slate-600">{item.type.replaceAll('_', ' ')}</td><td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-100 print:text-slate-900">{formatMoney(item.amount, item.currency)}</td></tr>)}{items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">No itemized activity is available for this source.</td></tr>}</tbody></table>
            </section>

            <section className="ml-auto grid max-w-md gap-2 rounded-2xl border border-white/[.08] bg-black/10 p-5 print:rounded-none print:border-slate-300 print:bg-white"><Total label="Gross / charges" value={document.grossAmount} currency={document.currency} /><Total label="Payments received" value={document.paidAmount} currency={document.currency} /><div className="my-1 border-t border-white/[.1] print:border-slate-300" /><Total label="Balance due" value={document.outstandingAmount} currency={document.currency} strong /></section>

            <section className="grid gap-5 lg:grid-cols-2 print:grid-cols-2">
              <ReadOnlyHistory title="Receipts and allocations" entries={[...history.payments.map((payment: any) => `${payment.receiptNumber || payment.reference || payment.id} · ${payment.status} · ${formatMoney(String(payment.amount), payment.currency)}`), ...history.allocations.map((allocation: any) => `Allocation ${allocation.id} · ${formatMoney(String(allocation.amount), allocation.currency)}`)]} empty="No linked receipts or allocation records were found." />
              <ReadOnlyHistory title="Credits and refunds" entries={[...history.credits.map((credit: any) => `Credit ${credit.id} · ${credit.status} · ${formatMoney(String(credit.amount), credit.currency)}`), ...history.refundRequests.map((refund: any) => `Refund request ${refund.id} · ${refund.status} · ${formatMoney(String(refund.requestedAmount), refund.currency)}`), ...history.refunds.map((refund: any) => `Refund ${refund.id} · ${refund.status} · ${formatMoney(String(refund.amount), refund.currency)}`)]} empty="No linked credit or refund records were found." />
            </section>

            <div className="hidden border-t border-slate-300 pt-4 text-[10px] text-slate-500 print:block">This document is a read-only presentation of LodgeCore source records. It does not issue, settle, refund, allocate, or post financial activity. Generated {formatDateTime(generatedAt)}.</div>
          </div>
        </article>

        <section className="grid gap-5 lg:grid-cols-2 print:hidden"><ReadOnlyHistory title="Journal references" entries={history.journals.map((line: any) => `${line.entry.entryNumber} · ${line.entry.status}${line.entry.isReversed ? ' · reversed' : ''} · ${line.account.code} ${line.account.name}`)} empty="No source-linked journal lines were found." /><ReadOnlyHistory title="Audit history" entries={history.audit.map((entry: any) => `${entry.action} · ${formatDate(entry.createdAt)} · ${entry.userEmail || entry.userRole || 'System actor'}`)} empty="No direct audit entries were found." /></section>
        <div className="flex flex-wrap gap-3 print:hidden"><Link href={isFolio ? `/frontdesk/folios/${document.sourceId}` : document.source === 'CITY_LEDGER_INVOICE' ? '/accountant/city-ledger/invoices' : '/frontdesk/event-invoices'} className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200">Open operational source <ExternalLink className="h-3.5 w-3.5" /></Link><span className="inline-flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Read-only financial presentation</span></div>
      </div>
    </main>
  );
}

function Brand({ property, print = false }: { property: { name: string; address: string; city: string; state: string; country: string; phone: string; email: string }; print?: boolean }) { return <div className={print ? 'text-slate-900' : ''}><p className="text-lg font-bold tracking-tight text-white print:text-slate-900">{property.name}</p><p className="mt-1 max-w-sm text-xs leading-5 text-slate-400 print:text-slate-600">{[property.address, property.city, property.state, property.country].filter(Boolean).join(', ')}</p><p className="mt-1 text-xs text-slate-500">{[property.phone, property.email].filter(Boolean).join(' · ')}</p></div>; }
function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1 text-xs leading-5 text-slate-400 print:text-slate-600"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>{children}</div>; }
function Total({ label, value, currency, strong = false }: { label: string; value: string; currency: string; strong?: boolean }) { return <div className={`flex items-center justify-between gap-4 text-sm ${strong ? 'font-bold text-white print:text-slate-900' : 'text-slate-400 print:text-slate-600'}`}><span>{label}</span><span className="tabular-nums">{formatMoney(value, currency)}</span></div>; }
function ReadOnlyHistory({ title, entries, empty }: { title: string; entries: string[]; empty: string }) { return <section className="rounded-2xl border border-white/[.08] bg-white/[.03] p-5 print:rounded-none print:border-slate-300 print:bg-white print:p-4"><h2 className="flex items-center gap-2 font-semibold text-white print:text-slate-900"><History className="h-4 w-4 text-cyan-300 print:text-slate-500" />{title}</h2>{entries.length ? <div className="mt-3 space-y-2">{entries.map(entry => <p key={entry} className="break-words rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-300 print:bg-slate-50 print:text-slate-700">{entry}</p>)}</div> : <p className="mt-3 text-xs text-slate-500">{empty}</p>}</section>; }
function Status({ status }: { status: string }) { return <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${status === 'PAID' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300 print:border-emerald-700 print:bg-emerald-50 print:text-emerald-700' : status === 'OVERDUE' ? 'border-rose-300/20 bg-rose-300/10 text-rose-300 print:border-rose-700 print:bg-rose-50 print:text-rose-700' : 'border-amber-300/20 bg-amber-300/10 text-amber-300 print:border-amber-700 print:bg-amber-50 print:text-amber-700'}`}>{status.replaceAll('_', ' ')}</span>; }
function formatMoney(value: string, currency: string) { const [integer, fraction] = String(value || '0').split('.'); const sign = integer.startsWith('-') ? '-' : ''; const digits = integer.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ','); return `${sign}${currency || 'NGN'} ${digits}${fraction ? `.${fraction}` : ''}`; }
function formatDate(value: string | Date | null | undefined) { return value ? new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(value)) : '—'; }
function formatDateTime(value: string | Date) { return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function Unavailable({ text }: { text: string }) { return <main className="flex min-h-full items-center justify-center bg-[#07111f] p-8 text-center text-slate-300"><div><FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" /><h1 className="text-xl font-semibold text-white">Document unavailable</h1><p className="mt-2 text-sm text-slate-400">{text}</p></div></main>; }
