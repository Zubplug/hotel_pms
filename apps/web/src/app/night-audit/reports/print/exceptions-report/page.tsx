'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function ExceptionsReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/exceptions-report?propertyId=${propertyId}&businessDate=${businessDate}`)
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
    if (!dateStr) return 'N/A';
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

  const { exceptions = {}, totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';

  const renderTable = (title: string, items: any[], totalKey: string) => {
    if (!items || items.length === 0) return null;
    
    return (
      <div className="mb-6">
        <h3 className="font-bold text-sm uppercase mb-2 pb-1 border-b border-slate-300 text-rose-800">
          {title}
        </h3>
        <table className="w-full text-[9px] leading-tight mb-2">
          <thead>
            <tr className="bg-rose-50 text-left border-y border-rose-200 text-rose-900">
              <th className="py-1 px-1 w-16">Time</th>
              <th className="py-1 px-1 w-24">Folio/Ref</th>
              <th className="py-1 px-1 w-32">Guest</th>
              <th className="py-1 px-1">Reason</th>
              <th className="py-1 px-1 w-24">Operator</th>
              <th className="py-1 px-1 w-24">Acknowledged By</th>
              <th className="py-1 px-1 w-24 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((ex: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-100">
                <td className="py-1 px-1">{formatDate(ex.timestamp)}</td>
                <td className="py-1 px-1 font-mono text-[8px]">{ex.folioId}</td>
                <td className="py-1 px-1 truncate">{ex.guestName}</td>
                <td className="py-1 px-1 truncate">{ex.reason}</td>
                <td className="py-1 px-1 truncate">{ex.operator}</td>
                <td className="py-1 px-1 truncate">{ex.acknowledgedBy || '—'}</td>
                <td className="py-1 px-1 text-right font-medium">{formatCurrency(Math.abs(ex.amount), currencyCode)}</td>
              </tr>
            ))}
            <tr className="bg-rose-50 font-semibold border-y border-rose-300 text-rose-900">
              <td colSpan={6} className="py-1.5 px-1 text-right uppercase tracking-wider text-[8px]">Total {title}</td>
              <td className="py-1.5 px-1 text-right">{formatCurrency(totals[totalKey], currencyCode)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const hasAnyRecords = data.grandTotal > 0 || exceptions.voids?.length > 0;

  return (
    <A4ReportWrapper
      title="Exceptions Report (Voids, Refunds, Comps)"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`EXC-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {!hasAnyRecords ? (
        <div className="py-20 text-center text-slate-500 italic text-sm">
          No exceptions for this business date.
        </div>
      ) : (
        <div className="w-full">
          {renderTable('Voided Transactions', exceptions.voids, 'voids')}
          {renderTable('Processed Refunds', exceptions.refunds, 'refunds')}
          {renderTable('Discounts Applied', exceptions.discounts, 'discounts')}
          {renderTable('Complimentary Authorizations', exceptions.comps, 'comps')}

          <div className="mt-8 pt-4 border-t-2 border-rose-800">
            <h3 className="font-bold text-sm uppercase mb-3 text-rose-900">Exceptions Summary</h3>
            <table className="w-1/2 text-[10px]">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Voids</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.voids, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Refunds</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.refunds, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Discounts</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.discounts, currencyCode)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 text-slate-600">Total Complimentaries</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(totals.comps, currencyCode)}</td>
                </tr>
                <tr className="bg-rose-100 font-bold border-b-2 border-rose-800 text-rose-900">
                  <td className="py-2 uppercase tracking-wider">Total Financial Impact</td>
                  <td className="py-2 text-right">{formatCurrency(data.grandTotal, currencyCode)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </A4ReportWrapper>
  );
}
