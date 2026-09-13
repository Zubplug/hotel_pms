'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function PaymentReconciliationReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/payment-reconciliation?propertyId=${propertyId}&businessDate=${businessDate}`)
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

  const { methods = [], totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';
  const hasRecords = methods.length > 0;

  return (
    <A4ReportWrapper
      title="Payment Reconciliation"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`PAY-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {!hasRecords ? (
        <div className="py-20 text-center text-slate-500 italic text-sm">
          No payment records for this business date.
        </div>
      ) : (
        <div className="w-full space-y-6">
          {methods.map((methodData: any, idx: number) => (
            <div key={idx} className="mb-4">
              <h3 className="font-bold text-sm uppercase mb-2 pb-1 border-b border-slate-300">
                {methodData.method.replace(/_/g, ' ')}
              </h3>
              <table className="w-full text-[9px] leading-tight mb-2">
                <thead>
                  <tr className="bg-slate-50 text-left border-y border-slate-200">
                    <th className="py-1 px-1 w-16">Time</th>
                    <th className="py-1 px-1 w-20">Type</th>
                    <th className="py-1 px-1 w-24">Folio ID</th>
                    <th className="py-1 px-1">Guest</th>
                    <th className="py-1 px-1 w-32">Reference</th>
                    <th className="py-1 px-1 w-24 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {methodData.transactions.map((tx: any, tIdx: number) => (
                    <tr key={tIdx} className="border-b border-slate-100">
                      <td className="py-1 px-1">{formatDate(tx.timestamp)}</td>
                      <td className={`py-1 px-1 ${tx.type === 'REFUND' ? 'text-rose-600' : ''}`}>{tx.type}</td>
                      <td className="py-1 px-1">{tx.folioId}</td>
                      <td className="py-1 px-1 truncate">{tx.guestName}</td>
                      <td className="py-1 px-1 font-mono text-[8px] truncate">{tx.reference}</td>
                      <td className="py-1 px-1 text-right font-medium">{formatCurrency(tx.amount, currencyCode)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-y border-slate-300">
                    <td colSpan={5} className="py-1.5 px-1 text-right uppercase tracking-wider text-[8px]">Net {methodData.method.replace(/_/g, ' ')}</td>
                    <td className="py-1.5 px-1 text-right">{formatCurrency(methodData.net, currencyCode)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <div className="mt-8 pt-4 border-t-2 border-slate-800">
            <h3 className="font-bold text-sm uppercase mb-3">Reconciliation Summary</h3>
            <table className="w-1/2 text-[10px]">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Payments Recorded</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.payments, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Refunds Recorded</td>
                  <td className="py-1.5 text-right font-medium text-rose-600">-{formatCurrency(totals.refunds, currencyCode)}</td>
                </tr>
                <tr className="bg-slate-100 font-bold border-b-2 border-slate-800">
                  <td className="py-2 uppercase tracking-wider">Net Payment Collection</td>
                  <td className="py-2 text-right">{formatCurrency(totals.net, currencyCode)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </A4ReportWrapper>
  );
}
