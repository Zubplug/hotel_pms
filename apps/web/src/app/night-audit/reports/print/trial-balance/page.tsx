'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function TrialBalanceReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/trial-balance?propertyId=${propertyId}&businessDate=${businessDate}`)
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

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  if (error || !data) {
    return <div className="flex h-screen items-center justify-center text-rose-500 font-medium">{error || 'Failed to load data'}</div>;
  }

  const { accounts = [], totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';

  return (
    <A4ReportWrapper
      title="Trial Balance Report"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`TB-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {accounts.length === 0 ? (
        <div className="py-20 text-center text-slate-500 italic">No records for this business date.</div>
      ) : (
        <div className="w-full min-w-0 overflow-hidden">
          <table className="w-full table-fixed text-xs text-left border-collapse print:text-[9px]">
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '11%' }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-slate-800">
                <th className="py-1.5 px-2 print:px-1 print:py-1 font-bold uppercase text-slate-700 break-words">Account Code</th>
                <th className="py-1.5 px-2 print:px-1 print:py-1 font-bold uppercase text-slate-700 break-words">Account Name</th>
                <th className="py-1.5 px-2 print:px-1 print:py-1 font-bold uppercase text-slate-700 break-words">Department</th>
                <th className="py-1.5 px-2 print:px-1 print:py-1 font-bold uppercase text-slate-700 text-right break-words">Debit</th>
                <th className="py-1.5 px-2 print:px-1 print:py-1 font-bold uppercase text-slate-700 text-right break-words">Credit</th>
                <th className="py-1.5 px-2 print:px-1 print:py-1 font-bold uppercase text-slate-700 text-right break-words">Net Balance</th>
                <th className="py-1.5 px-1 print:px-0.5 print:py-1 font-bold uppercase text-slate-700 text-center break-words">Trans Count</th>
                <th className="py-1.5 px-2 print:px-1 print:py-1 font-bold uppercase text-slate-700 whitespace-nowrap">Source</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc: any, index: number) => (
                <tr key={index} className="border-b border-slate-200">
                  <td className="py-1.5 px-2 print:px-1 print:py-1 whitespace-nowrap">{acc.accountCode}</td>
                  <td className="py-1.5 px-2 print:px-1 print:py-1 font-medium break-words">{acc.accountName}</td>
                  <td className="py-1.5 px-2 print:px-1 print:py-1 text-slate-600 break-words">{acc.department}</td>
                  <td className="py-1.5 px-2 print:px-1 print:py-1 text-right whitespace-nowrap">{formatCurrency(acc.debit || 0, currencyCode)}</td>
                  <td className="py-1.5 px-2 print:px-1 print:py-1 text-right whitespace-nowrap">{formatCurrency(acc.credit || 0, currencyCode)}</td>
                  <td className="py-1.5 px-2 print:px-1 print:py-1 text-right font-medium whitespace-nowrap">{formatCurrency(acc.netBalance || 0, currencyCode)}</td>
                  <td className="py-1.5 px-1 print:px-0.5 print:py-1 text-center text-slate-600 whitespace-nowrap">{acc.transactionCount}</td>
                  <td className="py-1.5 px-2 print:px-1 print:py-1 text-slate-600 whitespace-nowrap">{acc.source}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-b-2 border-slate-800 bg-slate-50 font-bold">
                <td colSpan={3} className="py-2 px-2 print:px-1 print:py-1 text-right uppercase tracking-wider text-slate-800">Totals</td>
                <td className="py-2 px-2 print:px-1 print:py-1 text-right whitespace-nowrap">{formatCurrency(totals.debit || 0, currencyCode)}</td>
                <td className="py-2 px-2 print:px-1 print:py-1 text-right whitespace-nowrap">{formatCurrency(totals.credit || 0, currencyCode)}</td>
                <td className="py-2 px-2 print:px-1 print:py-1 text-right whitespace-nowrap">{formatCurrency(totals.difference || 0, currencyCode)}</td>
                <td colSpan={2} className={`py-2 px-2 print:px-1 print:py-1 text-center break-words ${totals.status === 'OUT OF BALANCE' ? 'text-red-600' : 'text-green-600'}`}>
                  {totals.status || 'BALANCED'}
                </td>
              </tr>
            </tfoot>
          </table>
          
          <div className="mt-8 flex justify-end">
            <div className={`px-4 py-2 text-sm font-bold border-2 ${totals.status === 'OUT OF BALANCE' ? 'border-red-600 text-red-700 bg-red-50' : 'border-green-600 text-green-700 bg-green-50'}`}>
              BALANCE STATUS: {totals.status || 'BALANCED'}
            </div>
          </div>
        </div>
      )}
    </A4ReportWrapper>
  );
}
