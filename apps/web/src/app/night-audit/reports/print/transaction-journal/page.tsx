'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function TransactionJournalReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/transaction-journal?propertyId=${propertyId}&businessDate=${businessDate}`)
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

  const { transactions = [], totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';
  const hasRecords = transactions.length > 0;

  return (
    <A4ReportWrapper
      title="Transaction Journal"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`JNL-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {!hasRecords ? (
        <div className="py-20 text-center text-slate-500 italic text-sm">
          No transactions for this business date.
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full text-[9px] leading-tight">
            <thead>
              <tr className="border-b-2 border-slate-800 text-left">
                <th className="py-1.5 px-1 w-16">Time</th>
                <th className="py-1.5 px-1 w-12">Type</th>
                <th className="py-1.5 px-1 w-20">Source</th>
                <th className="py-1.5 px-1">Description</th>
                <th className="py-1.5 px-1 w-20">Folio ID</th>
                <th className="py-1.5 px-1 w-24">Guest</th>
                <th className="py-1.5 px-1 w-12 text-center">Room</th>
                <th className="py-1.5 px-1 w-24 text-right">Debit</th>
                <th className="py-1.5 px-1 w-24 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any, idx: number) => {
                const isDebitAmount = tx.isDebit || (tx.isException && tx.type !== 'REFUND');
                const isCreditAmount = tx.isCredit || tx.type === 'REFUND';

                return (
                  <tr key={idx} className={`border-b border-slate-100 ${tx.isVoided ? 'line-through text-slate-400' : ''}`}>
                    <td className="py-1.5 px-1">{formatDate(tx.timestamp)}</td>
                    <td className="py-1.5 px-1 text-[8px]">{tx.type}</td>
                    <td className="py-1.5 px-1 text-[8px]">{tx.source}</td>
                    <td className="py-1.5 px-1 truncate max-w-[140px]">{tx.description}</td>
                    <td className="py-1.5 px-1">{tx.folioId}</td>
                    <td className="py-1.5 px-1 truncate">{tx.guestName}</td>
                    <td className="py-1.5 px-1 text-center font-mono">{tx.roomNumber}</td>
                    <td className="py-1.5 px-1 text-right">
                      {isDebitAmount ? formatCurrency(tx.amount, currencyCode) : ''}
                    </td>
                    <td className="py-1.5 px-1 text-right">
                      {isCreditAmount ? formatCurrency(tx.amount, currencyCode) : ''}
                    </td>
                  </tr>
                );
              })}
              
              <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold">
                <td colSpan={7} className="py-2 px-1 uppercase tracking-wider text-right">Activity Totals</td>
                <td className="py-2 px-1 text-right">{formatCurrency(totals.charges + totals.exceptions, currencyCode)}</td>
                <td className="py-2 px-1 text-right">{formatCurrency(totals.payments, currencyCode)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </A4ReportWrapper>
  );
}
