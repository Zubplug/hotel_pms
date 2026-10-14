/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/static-components */
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

const n = (value: unknown) => Number(value || 0);

export default function DetailedRevenueReportPage() {
  const params = useSearchParams();
  const propertyId = params.get('propertyId');
  const businessDate = params.get('businessDate');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId || !businessDate) { setError('Missing propertyId or businessDate'); return; }
    fetch(`/api/v1/night-audit/reports/detailed-revenue?propertyId=${encodeURIComponent(propertyId)}&businessDate=${encodeURIComponent(businessDate)}`)
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.message || body?.message || 'Failed to load report'); return body.data || body; })
      .then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load report'));
  }, [propertyId, businessDate]);

  const money = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n(value));
  if (error) return <div className="flex h-screen items-center justify-center text-rose-600 font-medium">{error}</div>;
  if (!data) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  const code = data.propertyCurrency || 'NGN';
  const totals = data.totals || {};
  const reconciliation = data.reconciliation || {};
  const departments = data.departments || [];
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="mb-6 break-inside-avoid"><h2 className="mb-2 border-b-2 border-slate-800 pb-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-900">{title}</h2>{children}</section>;
  const Row = ({ label, value, total = false }: { label: string; value: React.ReactNode; total?: boolean }) => <tr className={total ? 'border-t-2 border-slate-800 bg-slate-50 font-bold' : 'border-b border-slate-100'}><td className="px-2 py-1.5">{label}</td><td className="px-2 py-1.5 text-right">{value}</td></tr>;
  const Variance = ({ value }: { value: unknown }) => <span className={Math.abs(n(value)) > 0.01 ? 'font-semibold text-rose-700' : 'text-emerald-700'}>{money(value, code)}</span>;
  const empty = <div className="py-4 text-center text-xs italic text-slate-500">No records for this business date.</div>;

  return <A4ReportWrapper title="Detailed Revenue Report" propertyName={data.propertyName || 'Hotel'} propertyEmail={data.propertyEmail} propertyPhone={data.propertyPhone} propertyAddress={data.propertyAddress} businessDate={businessDate || ''} reportId={`REV-${businessDate || 'REPORT'}`} status={data.auditStatus || 'NOT_RUN'}>
    <div className="mb-5 grid grid-cols-4 gap-2">
      {[['Gross revenue', money(totals.gross, code)], ['Net revenue', money(totals.net, code)], ['Taxes', money(totals.tax, code)], ['Total incl. tax', money(totals.total, code)], ['Discounts', money(totals.discounts, code)], ['Refunds', money(totals.refunds, code)], ['POS complimentary', money(data.controls?.complimentaryPos, code)], ['Transactions', totals.transactionCount || 0], ['Late postings / voids', `${data.controls?.latePostingCount || 0} / ${data.controls?.voidCount || 0}`]].map(([label, value], index) => <div key={String(label)} className={`border p-2 ${index < 4 ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200'}`}><div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>)}
    </div>

    <Section title="Revenue by department and source">
      {departments.length ? departments.map((department: any) => <div key={department.department} className="mb-5 break-inside-avoid"><h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">{department.department}</h3><table className="w-full table-fixed text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="w-[14%] px-2 py-1">Code</th><th className="w-[30%] px-2 py-1">Description</th><th className="w-[11%] px-2 py-1 text-right">Gross</th><th className="w-[11%] px-2 py-1 text-right">Discount</th><th className="w-[11%] px-2 py-1 text-right">Adjust.</th><th className="w-[11%] px-2 py-1 text-right">Net</th><th className="w-[11%] px-2 py-1 text-right">Tax</th><th className="w-[11%] px-2 py-1 text-right">Total</th></tr></thead><tbody>{department.revenues.map((row: any) => <tr key={`${row.code}-${row.description}`} className="border-b border-slate-100 align-top"><td className="break-words px-2 py-1">{row.code}</td><td className="break-words px-2 py-1">{row.description}</td><td className="px-2 py-1 text-right">{money(row.gross, code)}</td><td className="px-2 py-1 text-right">{money(row.discounts, code)}</td><td className="px-2 py-1 text-right">{money(row.adjustments, code)}</td><td className="px-2 py-1 text-right">{money(row.net, code)}</td><td className="px-2 py-1 text-right">{money(row.tax, code)}</td><td className="px-2 py-1 text-right font-semibold">{money(row.total, code)}</td></tr>)}</tbody></table></div>) : empty}
      <table className="w-full text-xs"><tbody><Row label="Grand total" value={money(totals.total, code)} total /><Row label="Charge net of discounts/adjustments/refunds" value={money(totals.net, code)} /><Row label="Tax total" value={money(totals.tax, code)} /></tbody></table>
    </Section>

    <div className="grid grid-cols-2 gap-x-8">
      <Section title="Tax and source analysis">{data.taxBreakdown?.length ? <table className="w-full text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Tax / source</th><th className="px-2 py-1 text-right">Tax</th><th className="px-2 py-1 text-right">Count</th></tr></thead><tbody>{data.taxBreakdown.map((row: any) => <tr key={row.description} className="border-b border-slate-100"><td className="px-2 py-1">{row.description}</td><td className="px-2 py-1 text-right">{money(row.tax, code)}</td><td className="px-2 py-1 text-right">{row.transactionCount}</td></tr>)}</tbody></table> : empty}</Section>
      <Section title="Payment method summary">{data.paymentTotals?.length ? <table className="w-full text-[10px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Method</th><th className="px-2 py-1 text-right">Amount</th><th className="px-2 py-1 text-right">Count</th></tr></thead><tbody>{data.paymentTotals.map((row: any) => <tr key={row.method} className="border-b border-slate-100"><td className="px-2 py-1">{row.method}</td><td className="px-2 py-1 text-right">{money(row.amount, code)}</td><td className="px-2 py-1 text-right">{row.transactionCount}</td></tr>)}</tbody></table> : empty}</Section>
    </div>

    <Section title="Night audit revenue reconciliation">
      <table className="w-full text-xs"><thead><tr className="border-b border-slate-300 text-left"><th className="px-2 py-1">Control</th><th className="px-2 py-1 text-right">Detailed report</th><th className="px-2 py-1 text-right">Night audit snapshot</th><th className="px-2 py-1 text-right">Variance</th></tr></thead><tbody>{[['Gross revenue', reconciliation.detail?.gross, reconciliation.snapshot?.gross, reconciliation.variance?.gross], ['Net revenue', reconciliation.detail?.net, reconciliation.snapshot?.net, reconciliation.variance?.net], ['Taxes', reconciliation.detail?.tax, reconciliation.snapshot?.tax, reconciliation.variance?.tax], ['Discounts', reconciliation.detail?.discounts, reconciliation.snapshot?.discounts, reconciliation.variance?.discounts], ['Refunds', reconciliation.detail?.refunds, reconciliation.snapshot?.refunds, reconciliation.variance?.refunds]].map(([label, detailValue, snapshotValue, variance]) => <tr key={String(label)} className="border-b border-slate-100"><td className="px-2 py-1">{label}</td><td className="px-2 py-1 text-right">{money(detailValue, code)}</td><td className="px-2 py-1 text-right">{money(snapshotValue, code)}</td><td className="px-2 py-1 text-right"><Variance value={variance} /></td></tr>)}</tbody></table>
    </Section>

    <Section title="Revenue control detail"><div className="grid grid-cols-4 gap-2 text-[10px]">{[['Folio items', data.controls?.itemCount], ['Revenue detail rows', data.controls?.detailCount], ['POS orders', data.controls?.posOrderCount], ['Represented POS orders', data.controls?.representedPosOrderCount], ['POS complimentary', money(data.controls?.complimentaryPos, code)], ['Late postings', data.controls?.latePostingCount], ['Voided items', data.controls?.voidCount], ['Audit errors', data.audit?.errors], ['Room charges posted', data.audit?.roomChargesPosted]].map(([label, value]) => <div key={String(label)} className="border border-slate-200 p-2"><div className="text-slate-500">{label}</div><div className="mt-1 font-semibold text-slate-900">{value || 0}</div></div>)}</div></Section>

    <Section title="Revenue transaction detail">{data.detail?.length ? <table className="w-full text-[9px]"><thead><tr className="border-b border-slate-300 text-left"><th className="px-1 py-1">Type</th><th className="px-1 py-1">Department</th><th className="px-1 py-1">Source</th><th className="px-1 py-1">Description</th><th className="px-1 py-1 text-right">Qty</th><th className="px-1 py-1 text-right">Amount</th><th className="px-1 py-1">Control</th></tr></thead><tbody>{data.detail.map((row: any) => <tr key={row.id} className="border-b border-slate-100"><td className="px-1 py-1">{row.type}</td><td className="px-1 py-1">{row.department}</td><td className="px-1 py-1">{row.source}</td><td className="max-w-[220px] break-words px-1 py-1">{row.description}</td><td className="px-1 py-1 text-right">{row.quantity}</td><td className="px-1 py-1 text-right">{money(row.amount, code)}</td><td className="px-1 py-1">{row.latePosting ? 'LATE' : '—'}</td></tr>)}</tbody></table> : empty}</Section>
  </A4ReportWrapper>;
}
