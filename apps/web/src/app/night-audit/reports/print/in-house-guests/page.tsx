'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function displayDate(value?: string | null) {
  if (!value) return '—';
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function displayDateTime(value?: string | null) {
  if (!value) return 'End of business date';
  return dateTimeFormatter.format(new Date(value));
}

function paymentTone(status: string) {
  if (status === 'PAID' || status === 'CREDIT') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PARTIAL') return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

export default function InHouseGuestsReportPage() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId');
  const businessDate = searchParams.get('businessDate');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId || !businessDate) {
      setError('Missing propertyId or businessDate');
      setLoading(false);
      return;
    }
    fetch(`/api/v1/night-audit/reports/in-house-guests?propertyId=${encodeURIComponent(propertyId)}&businessDate=${encodeURIComponent(businessDate)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch report');
        return response.json();
      })
      .then((response) => { setData(response.data || response); setLoading(false); })
      .catch((cause) => { setError(cause.message); setLoading(false); });
  }, [propertyId, businessDate]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (error || !data) return <div className="flex h-screen items-center justify-center font-medium text-rose-500">{error || 'Failed to load data'}</div>;

  const guests = data.guests || [];
  const totals = data.totals || {};
  const currencyCode = data.propertyCurrency || 'NGN';
  const money = (amount: number) => formatCurrency(Number(amount || 0), currencyCode);

  return (
    <A4ReportWrapper
      title="In-House Guest & Folio Report"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`IHG-${businessDate?.replaceAll('-', '') || 'REPORT'}`}
      status={data.auditStatus || 'NOT_RUN'}
    >
      <div className="space-y-5 text-[10px] text-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-[9px] uppercase tracking-wider text-slate-500">
          <span>Snapshot basis: stays covering the business date</span>
          <span>As of: {displayDateTime(data.asOf)}</span>
          {data.runReference && <span>Run: {data.runReference}</span>}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            ['Occupied rooms', totals.occupiedRooms, ''],
            ['Reservations', totals.reservations, ''],
            ['Guests in house', totals.guestsInHouse, `${totals.adults || 0} adults · ${totals.children || 0} children`],
            ['Due out today', totals.dueOuts, ''],
            ['Outstanding', money(totals.outstandingBalances), `${totals.unpaid || 0} unpaid · ${totals.partial || 0} partial`],
            ['Guest credits', money(totals.availableCredits), ''],
            ['Room charges', money(totals.roomCharges), ''],
            ['Payments', money(totals.payments), `${totals.vip || 0} VIP guests`],
          ].map(([label, value, detail]) => (
            <div key={String(label)} className="border border-slate-200 bg-slate-50 p-2.5">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
              <div className="mt-1 text-base font-bold text-slate-900">{value}</div>
              {detail && <div className="mt-0.5 text-[8px] text-slate-500">{detail}</div>}
            </div>
          ))}
        </div>

        {guests.length === 0 ? (
          <div className="border border-dashed border-slate-300 py-20 text-center italic text-slate-500">No in-house stays were recorded for this business date.</div>
        ) : (
          <>
            <div>
              <h2 className="mb-2 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-widest">Guest stay register ({guests.length})</h2>
              <table className="w-full border-collapse text-[8.5px] leading-tight">
                <thead>
                  <tr className="border-y border-slate-300 bg-slate-50 text-left uppercase tracking-wider">
                    <th className="px-1 py-1.5">Room / type</th>
                    <th className="px-1 py-1.5">Guest / company</th>
                    <th className="px-1 py-1.5">Confirmation</th>
                    <th className="px-1 py-1.5">Stay</th>
                    <th className="px-1 py-1.5 text-center">A/C</th>
                    <th className="px-1 py-1.5 text-right">Rate</th>
                    <th className="px-1 py-1.5 text-right">Charges</th>
                    <th className="px-1 py-1.5 text-right">Payments</th>
                    <th className="px-1 py-1.5 text-right">Balance</th>
                    <th className="px-1 py-1.5">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((guest: any) => (
                    <tr key={guest.id} className="border-b border-slate-200 align-top">
                      <td className="px-1 py-2 font-semibold">{guest.room}<br /><span className="font-normal text-slate-500">{guest.roomType}</span></td>
                      <td className="px-1 py-2"><span className="font-semibold">{guest.guestName}</span><br /><span className="text-slate-500">{guest.company}</span></td>
                      <td className="px-1 py-2 font-mono">{guest.reservationRef}</td>
                      <td className="px-1 py-2 whitespace-nowrap">{displayDate(guest.arrival)}<br /><span className="text-slate-500">to {displayDate(guest.departure)} · {guest.nights}N</span></td>
                      <td className="px-1 py-2 text-center">{guest.adults}/{guest.children}</td>
                      <td className="px-1 py-2 text-right whitespace-nowrap">{money(guest.rate)}</td>
                      <td className="px-1 py-2 text-right whitespace-nowrap">{money(guest.charges)}</td>
                      <td className="px-1 py-2 text-right whitespace-nowrap">{money(guest.payments)}</td>
                      <td className={`px-1 py-2 text-right font-semibold whitespace-nowrap ${guest.folioBalance > 0 ? 'text-rose-700' : guest.folioBalance < 0 ? 'text-emerald-700' : ''}`}>{money(guest.folioBalance)}</td>
                      <td className="px-1 py-2"><span className={`rounded px-1 py-0.5 text-[8px] font-bold ${paymentTone(guest.paymentStatus)}`}>{guest.paymentStatus}</span><br /><span className="text-slate-500">{guest.vipStatus !== 'Regular' ? guest.vipStatus : guest.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="mb-2 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-widest">Operational detail</h2>
              <table className="w-full border-collapse text-[8.5px]">
                <thead><tr className="border-b border-slate-300 bg-slate-50 text-left uppercase tracking-wider"><th className="px-1 py-1.5">Guest / room</th><th className="px-1 py-1.5">Contact</th><th className="px-1 py-1.5">Occupants</th><th className="px-1 py-1.5">Folio(s)</th><th className="px-1 py-1.5">Stay controls / requests</th></tr></thead>
                <tbody>
                  {guests.map((guest: any) => (
                    <tr key={`${guest.id}-detail`} className="border-b border-slate-200 align-top">
                      <td className="px-1 py-1.5 font-semibold">{guest.guestName} · {guest.room}</td>
                      <td className="px-1 py-1.5">{guest.phone}<br />{guest.email}</td>
                      <td className="px-1 py-1.5">{guest.occupants?.length ? guest.occupants.join(', ') : `${guest.adults} adult(s), ${guest.children} child(ren)`}</td>
                      <td className="px-1 py-1.5 font-mono">{guest.folioNumbers?.join(', ') || 'No folio'}</td>
                      <td className="px-1 py-1.5">{guest.earlyCheckIn ? 'Early check-in' : ''}{guest.earlyCheckIn && guest.lateCheckOut ? ' · ' : ''}{guest.lateCheckOut ? 'Late checkout' : ''}{(guest.earlyCheckIn || guest.lateCheckOut) && guest.specialRequests !== '—' ? ' · ' : ''}{guest.specialRequests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t-2 border-slate-800 pt-3 text-[9px] text-slate-600">
              <p><strong>Control interpretation:</strong> Balance is the aggregated balance across all non-void reservation folios. Positive balances require collection; negative balances are guest credits. This report excludes cancelled, no-show, expired, pending, and non-room-assigned stays.</p>
              <p className="mt-1">Historical rows are selected by the reservation-room stay interval covering the business date, with the night-audit cutoff shown above when available.</p>
            </div>
          </>
        )}
      </div>
    </A4ReportWrapper>
  );
}
