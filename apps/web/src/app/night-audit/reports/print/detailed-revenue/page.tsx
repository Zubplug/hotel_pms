'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function DetailedRevenueReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/detailed-revenue?propertyId=${propertyId}&businessDate=${businessDate}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch report');
          return res.json();
        })
        .then(res => {
          setData(res);
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

  const { departments = [], totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';

  const hasRecords = departments.length > 0;

  return (
    <A4ReportWrapper
      title="Detailed Revenue Report"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      businessDate={businessDate || ''}
      reportId={`REV-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {!hasRecords ? (
        <div className="py-20 text-center text-slate-500 italic text-sm">
          No records for this business date.
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-slate-800 text-left">
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide">Department</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide">Revenue Code</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide">Description</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide text-right">Gross Revenue</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide text-right">Discounts</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide text-right">Adjustments</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide text-right">Net Revenue</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide text-right">Tax</th>
                <th className="py-1.5 px-2 font-bold uppercase tracking-wide text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept: any, deptIdx: number) => (
                <React.Fragment key={deptIdx}>
                  {dept.revenues.map((rev: any, revIdx: number) => (
                    <tr key={`${deptIdx}-${revIdx}`} className="border-b border-slate-200">
                      <td className="py-1.5 px-2 font-medium">{revIdx === 0 ? dept.department : ''}</td>
                      <td className="py-1.5 px-2">{rev.code}</td>
                      <td className="py-1.5 px-2">{rev.description}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(rev.gross, currencyCode)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(rev.discounts, currencyCode)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(rev.adjustments, currencyCode)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(rev.net, currencyCode)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(rev.tax, currencyCode)}</td>
                      <td className="py-1.5 px-2 text-right font-semibold">{formatCurrency(rev.total, currencyCode)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              
              <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold">
                <td colSpan={3} className="py-2 px-2 uppercase tracking-wider text-right">Grand Total</td>
                <td className="py-2 px-2 text-right">{formatCurrency(totals.gross, currencyCode)}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(totals.discounts, currencyCode)}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(totals.adjustments, currencyCode)}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(totals.net, currencyCode)}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(totals.tax, currencyCode)}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(totals.total, currencyCode)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </A4ReportWrapper>
  );
}
