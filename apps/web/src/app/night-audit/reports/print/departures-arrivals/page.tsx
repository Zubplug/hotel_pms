'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';

export default function DeparturesArrivalsReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/departures-arrivals?propertyId=${propertyId}&businessDate=${businessDate}`)
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

  const { expectedArrivals = [], expectedDepartures = [], metrics = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';

  const hasRecords = expectedArrivals.length > 0 || expectedDepartures.length > 0;

  return (
    <A4ReportWrapper
      title="Departures & Arrivals Report"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`ARRDEP-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {!hasRecords ? (
        <div className="py-20 text-center text-slate-500 italic">No records for this business date.</div>
      ) : (
        <div className="space-y-8">
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <div className="text-xs text-slate-500 font-medium mb-1 uppercase tracking-wider">Metrics</div>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>No-Shows:</span> <strong>{metrics.noShows || 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Early Arrivals:</span> <strong>{metrics.earlyArrivals || 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Early Departures:</span> <strong>{metrics.earlyDepartures || 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Extensions:</span> <strong>{metrics.extensions || 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Unconfirmed Departures:</span> <strong>{metrics.unconfirmedDepartures || 0}</strong>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b-2 border-slate-800 pb-1 mb-3">
              EXPECTED ARRIVALS ({expectedArrivals.length})
            </h2>
            {expectedArrivals.length === 0 ? (
              <div className="text-xs italic text-slate-500">No expected arrivals</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-1.5 px-2 text-left font-bold">Guest Name</th>
                    <th className="py-1.5 px-2 text-left font-bold">Res ID</th>
                    <th className="py-1.5 px-2 text-left font-bold">Room / Type</th>
                    <th className="py-1.5 px-2 text-right font-bold">Rate</th>
                    <th className="py-1.5 px-2 text-right font-bold">Balance</th>
                    <th className="py-1.5 px-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expectedArrivals.map((arr: any, i: number) => (
                    <tr key={arr.id || i} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 px-2">{arr.guestName || '-'}</td>
                      <td className="py-1.5 px-2">{arr.reservationId || arr.id || '-'}</td>
                      <td className="py-1.5 px-2">
                        {arr.roomNumber ? `${arr.roomNumber} - ${arr.roomType || ''}` : (arr.roomType || '-')}
                      </td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(arr.rate, currencyCode)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(arr.balance, currencyCode)}</td>
                      <td className="py-1.5 px-2">{arr.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b-2 border-slate-800 pb-1 mb-3">
              EXPECTED DEPARTURES ({expectedDepartures.length})
            </h2>
            {expectedDepartures.length === 0 ? (
              <div className="text-xs italic text-slate-500">No expected departures</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-1.5 px-2 text-left font-bold">Guest Name</th>
                    <th className="py-1.5 px-2 text-left font-bold">Res ID</th>
                    <th className="py-1.5 px-2 text-left font-bold">Room / Type</th>
                    <th className="py-1.5 px-2 text-right font-bold">Rate</th>
                    <th className="py-1.5 px-2 text-right font-bold">Balance</th>
                    <th className="py-1.5 px-2 text-left font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expectedDepartures.map((dep: any, i: number) => (
                    <tr key={dep.id || i} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 px-2">{dep.guestName || '-'}</td>
                      <td className="py-1.5 px-2">{dep.reservationId || dep.id || '-'}</td>
                      <td className="py-1.5 px-2">
                        {dep.roomNumber ? `${dep.roomNumber} - ${dep.roomType || ''}` : (dep.roomType || '-')}
                      </td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(dep.rate, currencyCode)}</td>
                      <td className="py-1.5 px-2 text-right">{formatCurrency(dep.balance, currencyCode)}</td>
                      <td className="py-1.5 px-2">{dep.status || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>
      )}
    </A4ReportWrapper>
  );
}
