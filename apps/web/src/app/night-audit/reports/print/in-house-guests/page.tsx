'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function InHouseGuestsReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propertyId && businessDate) {
      fetch(`/api/v1/night-audit/reports/in-house-guests?propertyId=${propertyId}&businessDate=${businessDate}`)
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

  const { guests = [], totals = {} } = data;
  const currencyCode = data.propertyCurrency || 'NGN';

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  return (
    <A4ReportWrapper
      title="In-House Guest List"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`IHG-${Date.now().toString().slice(-6)}`}
      status={data.auditStatus || 'CLOSED'}
    >
      {guests.length === 0 ? (
        <div className="py-20 text-center text-slate-500 italic">No records for this business date.</div>
      ) : (
        <div className="mt-4">
          <table className="w-full text-[10px] text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 text-slate-800 uppercase tracking-wider">
                <th className="py-2 px-1 font-bold">Room</th>
                <th className="py-2 px-1 font-bold">Guest Name</th>
                <th className="py-2 px-1 font-bold">Res#</th>
                <th className="py-2 px-1 font-bold">Arrival</th>
                <th className="py-2 px-1 font-bold">Departure</th>
                <th className="py-2 px-1 font-bold text-center">A/C</th>
                <th className="py-2 px-1 font-bold text-right">Rate</th>
                <th className="py-2 px-1 font-bold text-right">Folio Balance</th>
                <th className="py-2 px-1 font-bold text-right">Credit</th>
                <th className="py-2 px-1 font-bold">Payment Status</th>
                <th className="py-2 px-1 font-bold">VIP</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest: any, index: number) => (
                <tr key={index} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                  <td className="py-1.5 px-1 font-semibold">{guest.room || '-'}</td>
                  <td className="py-1.5 px-1 truncate max-w-[120px]">{guest.guestName || '-'}</td>
                  <td className="py-1.5 px-1 text-slate-500">{guest.reservationRef || '-'}</td>
                  <td className="py-1.5 px-1">{formatDate(guest.arrival)}</td>
                  <td className="py-1.5 px-1">{formatDate(guest.departure)}</td>
                  <td className="py-1.5 px-1 text-center">{guest.adults || 0}/{guest.children || 0}</td>
                  <td className="py-1.5 px-1 text-right">{formatCurrency(guest.rate || 0, currencyCode)}</td>
                  <td className="py-1.5 px-1 text-right font-medium">
                    {formatCurrency(guest.folioBalance || 0, currencyCode)}
                  </td>
                  <td className="py-1.5 px-1 text-right text-emerald-600">
                    {formatCurrency(guest.creditAvailable || 0, currencyCode)}
                  </td>
                  <td className="py-1.5 px-1">
                    <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700">
                      {guest.paymentStatus || 'Pending'}
                    </span>
                  </td>
                  <td className="py-1.5 px-1 text-xs">
                    {guest.vipStatus ? <span className="font-semibold text-amber-600">{guest.vipStatus}</span> : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom Totals */}
          <div className="mt-8 border-t-2 border-slate-800 pt-4 grid grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200">
              <div className="text-slate-500 uppercase tracking-widest mb-1 text-[9px]">Occupied Rooms</div>
              <div className="font-bold text-lg text-slate-900">{totals.occupiedRooms || 0}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-sm border border-slate-200">
              <div className="text-slate-500 uppercase tracking-widest mb-1 text-[9px]">Guests In-House</div>
              <div className="font-bold text-lg text-slate-900">{totals.guestsInHouse || 0}</div>
            </div>
            <div className="bg-rose-50 p-3 rounded-sm border border-rose-100">
              <div className="text-rose-600 uppercase tracking-widest mb-1 text-[9px]">Outstanding Balances</div>
              <div className="font-bold text-lg text-rose-700">
                {formatCurrency(totals.outstandingBalances || 0, currencyCode)}
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-sm border border-emerald-100">
              <div className="text-emerald-600 uppercase tracking-widest mb-1 text-[9px]">Available Credits</div>
              <div className="font-bold text-lg text-emerald-700">
                {formatCurrency(totals.availableCredits || 0, currencyCode)}
              </div>
            </div>
          </div>
        </div>
      )}
    </A4ReportWrapper>
  );
}
