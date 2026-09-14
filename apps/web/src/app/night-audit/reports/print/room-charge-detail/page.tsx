'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function RoomChargeDetailReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/room-charge-detail?propertyId=${propertyId}&businessDate=${businessDate}`)
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

  const { sources = [], totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';
  const hasRecords = sources.length > 0;

  return (
    <A4ReportWrapper
      title="Guest Folio Postings (POS / External)"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`ANC-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {!hasRecords ? (
        <div className="py-20 text-center text-slate-500 italic text-sm">
          No POS/External charges were posted to guest folios for this business date.
        </div>
      ) : (
        <div className="w-full space-y-6">
          {sources.map((src: any, idx: number) => (
            <div key={idx} className="mb-4">
              <h3 className="font-bold text-sm uppercase mb-2 pb-1 border-b border-slate-300">
                Department: {src.source}
              </h3>
              <table className="w-full text-[9px] leading-tight mb-2">
                <thead>
                  <tr className="bg-slate-50 text-left border-y border-slate-200">
                    <th className="py-1 px-1 w-16">Time</th>
                    <th className="py-1 px-1 w-12 text-center">Room</th>
                    <th className="py-1 px-1 w-32">Guest Name</th>
                    <th className="py-1 px-1 w-24">Folio ID</th>
                    <th className="py-1 px-1 w-24">POS/Ticket Ref</th>
                    <th className="py-1 px-1">Description</th>
                    <th className="py-1 px-1 w-24 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {src.charges.map((c: any, cIdx: number) => (
                    <tr key={cIdx} className={`border-b border-slate-100 ${c.isVoided ? 'line-through text-slate-400' : ''}`}>
                      <td className="py-1 px-1">{formatDate(c.timestamp)}</td>
                      <td className="py-1 px-1 text-center font-bold">{c.roomNumber}</td>
                      <td className="py-1 px-1 truncate">{c.guestName}</td>
                      <td className="py-1 px-1 font-mono text-[8px]">{c.folioId}</td>
                      <td className="py-1 px-1 font-mono text-[8px]">{c.posRef}</td>
                      <td className="py-1 px-1 truncate">{c.description}</td>
                      <td className="py-1 px-1 text-right font-medium">
                        {c.isVoided ? '-' : formatCurrency(c.amount, currencyCode)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-y border-slate-300">
                    <td colSpan={6} className="py-1.5 px-1 text-right uppercase tracking-wider text-[8px]">Total {src.source} Charges</td>
                    <td className="py-1.5 px-1 text-right">{formatCurrency(src.total, currencyCode)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <div className="mt-8 pt-4 border-t-2 border-slate-800">
            <h3 className="font-bold text-sm uppercase mb-3">Postings Summary</h3>
            <table className="w-1/2 text-[10px]">
              <tbody>
                <tr className="bg-slate-100 font-bold border-b-2 border-slate-800">
                  <td className="py-2 uppercase tracking-wider">Total POS/External Folio Postings</td>
                  <td className="py-2 text-right">{formatCurrency(totals.totalCharges, currencyCode)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </A4ReportWrapper>
  );
}
