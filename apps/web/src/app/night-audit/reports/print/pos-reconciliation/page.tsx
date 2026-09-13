'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function PosReconciliationReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/pos-reconciliation?propertyId=${propertyId}&businessDate=${businessDate}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch report');
          return res.json();
        })
        .then(res => {
          setData(res.data || res);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setError("Missing propertyId or businessDate");
      setLoading(false);
    }
  }, [propertyId, businessDate]);

  const formatCurrency = (amount: number = 0, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center text-rose-500 font-medium">
        {error || 'Failed to load data'}
      </div>
    );
  }

  const { outlets = [], totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';
  const hasRecords = outlets.length > 0;

  return (
    <A4ReportWrapper
      title="POS Revenue Reconciliation"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`POS-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {!hasRecords ? (
        <div className="py-20 text-center text-slate-500 italic text-sm">
          No POS activity for this business date.
        </div>
      ) : (
        <div className="w-full space-y-8">
          {outlets.map((out: any, idx: number) => (
            <div key={idx} className="mb-4">
              <h3 className="font-bold text-sm uppercase mb-2 pb-1 border-b border-slate-300">
                {out.outletName}
              </h3>
              <table className="w-full text-[9px] leading-tight mb-2">
                <thead>
                  <tr className="bg-slate-50 text-left border-y border-slate-200">
                    <th className="py-1 px-1 w-24">Session ID</th>
                    <th className="py-1 px-1 w-20">Status</th>
                    <th className="py-1 px-1 text-right">Gross Sales</th>
                    <th className="py-1 px-1 text-right">Discounts</th>
                    <th className="py-1 px-1 text-right">Net Sales</th>
                    <th className="py-1 px-1 text-right">Expected Cash</th>
                    <th className="py-1 px-1 text-right">Actual Cash</th>
                    <th className="py-1 px-1 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {out.sessions.map((s: any, sIdx: number) => (
                    <tr key={sIdx} className="border-b border-slate-100">
                      <td className="py-1 px-1 font-mono text-[8px]">{s.id.slice(0, 8)}</td>
                      <td className="py-1 px-1">{s.status}</td>
                      <td className="py-1 px-1 text-right">{formatCurrency(s.gross, currencyCode)}</td>
                      <td className="py-1 px-1 text-right">{formatCurrency(s.discount, currencyCode)}</td>
                      <td className="py-1 px-1 text-right font-medium">{formatCurrency(s.net, currencyCode)}</td>
                      <td className="py-1 px-1 text-right">{formatCurrency(s.expectedCash, currencyCode)}</td>
                      <td className="py-1 px-1 text-right">{formatCurrency(s.actualCash, currencyCode)}</td>
                      <td className={`py-1 px-1 text-right font-bold ${s.variance !== 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(s.variance, currencyCode)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-y border-slate-300">
                    <td colSpan={2} className="py-1.5 px-1 text-right uppercase tracking-wider text-[8px]">Outlet Totals</td>
                    <td className="py-1.5 px-1 text-right">{formatCurrency(out.grossSales, currencyCode)}</td>
                    <td className="py-1.5 px-1 text-right">{formatCurrency(out.discounts, currencyCode)}</td>
                    <td className="py-1.5 px-1 text-right text-indigo-700">{formatCurrency(out.netSales, currencyCode)}</td>
                    <td className="py-1.5 px-1 text-right">{formatCurrency(out.expectedCash, currencyCode)}</td>
                    <td className="py-1.5 px-1 text-right">{formatCurrency(out.actualCash, currencyCode)}</td>
                    <td className="py-1.5 px-1 text-right">{formatCurrency(out.variance, currencyCode)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-[9px] text-slate-500 mt-1">
                Room charges posted from this outlet: <strong>{formatCurrency(out.roomCharges, currencyCode)}</strong>
              </div>
            </div>
          ))}

          <div className="mt-8 pt-4 border-t-2 border-slate-800">
            <h3 className="font-bold text-sm uppercase mb-3">Consolidated POS Summary</h3>
            <table className="w-1/2 text-[10px]">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Gross Sales</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.gross, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Discounts</td>
                  <td className="py-1.5 text-right font-medium text-rose-600">-{formatCurrency(totals.discounts, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Taxes</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.taxes, currencyCode)}</td>
                </tr>
                <tr className="bg-slate-100 font-bold border-b-2 border-slate-800">
                  <td className="py-2 uppercase tracking-wider">Net Sales (Pre-Tax)</td>
                  <td className="py-2 text-right">{formatCurrency(totals.net, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600 pt-4">Total Expected Cash</td>
                  <td className="py-1.5 text-right font-medium pt-4">{formatCurrency(totals.expectedCash, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Actual Cash Dropped</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.actualCash, currencyCode)}</td>
                </tr>
                <tr className={`font-bold border-b-2 border-slate-800 ${totals.variance !== 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  <td className="py-2 uppercase tracking-wider">Total Cash Variance</td>
                  <td className="py-2 text-right">{formatCurrency(totals.variance, currencyCode)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </A4ReportWrapper>
  );
}
