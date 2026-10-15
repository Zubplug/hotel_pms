'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { A4ReportWrapper } from '@/components/night-audit/reports/A4ReportWrapper';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function dateLabel(value?: string | null) {
  if (!value) return '—';
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function dateTimeLabel(value?: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Not recorded';
}

function money(value: number, currency: string) {
  return formatCurrency(Number(value || 0), currency);
}

function tone(status: string) {
  if (status === 'CHECKED_IN' || status === 'CHECKED_OUT' || status === 'PAID') return 'bg-emerald-50 text-emerald-700';
  if (status === 'PENDING' || status === 'CONFIRMED' || status === 'PARTIAL') return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
}

export default function DeparturesArrivalsReportPage() {
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
    fetch(`/api/v1/night-audit/reports/departures-arrivals?propertyId=${encodeURIComponent(propertyId)}&businessDate=${encodeURIComponent(businessDate)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch report');
        return response.json();
      })
      .then((response) => { setData(response.data || response); setLoading(false); })
      .catch((cause) => { setError(cause.message); setLoading(false); });
  }, [propertyId, businessDate]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (error || !data) return <div className="flex h-screen items-center justify-center font-medium text-rose-500">{error || 'Failed to load data'}</div>;

  const currency = data.propertyCurrency || 'NGN';
  const metrics = data.metrics || {};
  const arrivals = data.expectedArrivals || [];
  const departures = data.expectedDepartures || [];
  const hasRecords = arrivals.length || departures.length || data.cancelled?.length || data.noShows?.length;

  const movementTable = (title: string, rows: any[], kind: 'arrival' | 'departure') => (
    <section>
      <h2 className="mb-2 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-widest">{title} ({rows.length})</h2>
      {!rows.length ? <p className="py-3 text-xs italic text-slate-500">No records.</p> : (
        <table className="w-full border-collapse text-[8.5px] leading-tight">
          <thead><tr className="border-y border-slate-300 bg-slate-50 text-left uppercase tracking-wider">
            <th className="px-1 py-1.5">Guest / company</th><th className="px-1 py-1.5">Room / type</th><th className="px-1 py-1.5">Confirmation</th><th className="px-1 py-1.5">Stay</th><th className="px-1 py-1.5 text-center">A/C</th><th className="px-1 py-1.5 text-right">Rate</th><th className="px-1 py-1.5 text-right">Balance</th><th className="px-1 py-1.5">Status / timing</th>
          </tr></thead>
          <tbody>{rows.map((row: any) => (
            <tr key={`${kind}-${row.id}`} className="border-b border-slate-200 align-top">
              <td className="px-1 py-2"><span className="font-semibold">{row.guestName}</span><br /><span className="text-slate-500">{row.company}</span></td>
              <td className="px-1 py-2 font-semibold">{row.roomNumber}<br /><span className="font-normal text-slate-500">{row.roomType}</span></td>
              <td className="px-1 py-2 font-mono">{row.reservationId}</td>
              <td className="px-1 py-2 whitespace-nowrap">{dateLabel(row.arrival)}<br /><span className="text-slate-500">to {dateLabel(row.departure)} · {row.nights}N</span></td>
              <td className="px-1 py-2 text-center">{row.adults}/{row.children}</td>
              <td className="px-1 py-2 text-right whitespace-nowrap">{money(row.rate, currency)}</td>
              <td className={`px-1 py-2 text-right font-semibold whitespace-nowrap ${row.balance > 0 ? 'text-rose-700' : row.balance < 0 ? 'text-emerald-700' : ''}`}>{money(row.balance, currency)}<br /><span className="font-normal text-slate-500">{row.paymentStatus}</span></td>
              <td className="px-1 py-2"><span className={`rounded px-1 py-0.5 text-[8px] font-bold ${tone(row.status)}`}>{row.status}</span><br /><span className="text-slate-500">{kind === 'arrival' ? dateTimeLabel(row.checkedInAt) : dateTimeLabel(row.checkedOutAt)}</span></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );

  return (
    <A4ReportWrapper
      title="Arrivals & Departures Control"
      propertyName={data.propertyName || 'LodgeCore Hotel'}
      propertyEmail={data.propertyEmail}
      propertyPhone={data.propertyPhone}
      propertyAddress={data.propertyAddress}
      businessDate={businessDate || ''}
      reportId={`ARRDEP-${businessDate?.replaceAll('-', '') || 'REPORT'}`}
      status={data.auditStatus || 'NOT_RUN'}
    >
      <div className="space-y-5 text-[10px] text-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-[9px] uppercase tracking-wider text-slate-500">
          <span>Source: {data.historicalSource === 'NIGHT_AUDIT_MOVEMENT_SNAPSHOT' ? 'immutable night-audit movement register' : 'reservation fallback'}</span>
          <span>As of: {data.asOf ? dateTimeFormatter.format(new Date(data.asOf)) : 'end of business date'}</span>
          {data.runReference && <span>Run: {data.runReference}</span>}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            ['Arrivals', metrics.arrivals], ['Checked in', metrics.checkedInArrivals], ['Pending / late', metrics.pendingArrivals], ['No-shows', metrics.noShows],
            ['Cancellations', metrics.cancellations], ['Departures', metrics.departures], ['Departed', metrics.completedDepartures], ['Still in house', metrics.outstandingDepartures],
            ['Arrival balance', money(metrics.arrivalBalances, currency)], ['Due-out balance', money(metrics.dueOutBalances, currency)], ['VIP movements', metrics.vipMovements], ['Audit source', data.historicalSource === 'NIGHT_AUDIT_MOVEMENT_SNAPSHOT' ? 'Snapshot' : 'Fallback'],
          ].map(([label, value]) => <div key={String(label)} className="border border-slate-200 bg-slate-50 p-2.5"><div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{label}</div><div className="mt-1 text-base font-bold text-slate-900">{value}</div></div>)}
        </div>

        {!hasRecords ? <div className="border border-dashed border-slate-300 py-20 text-center italic text-slate-500">No arrivals, departures, cancellations, or no-shows were recorded for this business date.</div> : <>
          {movementTable('Arrivals scheduled', arrivals, 'arrival')}
          {movementTable('Departures scheduled', departures, 'departure')}
          <div className="grid grid-cols-2 gap-5">
            {movementTable('No-shows', data.noShows || [], 'arrival')}
            {movementTable('Cancellations', data.cancelled || [], 'arrival')}
          </div>
          <section>
            <h2 className="mb-2 border-b-2 border-slate-800 pb-1 text-sm font-bold uppercase tracking-widest">Outstanding movement controls</h2>
            <table className="w-full border-collapse text-[8.5px]">
              <thead><tr className="border-y border-slate-300 bg-slate-50 text-left uppercase tracking-wider"><th className="px-1 py-1.5">Guest / room</th><th className="px-1 py-1.5">Contact</th><th className="px-1 py-1.5">Folio / balance</th><th className="px-1 py-1.5">Source / VIP</th><th className="px-1 py-1.5">Requests / controls</th></tr></thead>
              <tbody>{[...(data.outstandingDepartures || []), ...(data.checkedInArrivals || [])].map((row: any) => <tr key={`control-${row.id}`} className="border-b border-slate-200 align-top"><td className="px-1 py-1.5 font-semibold">{row.guestName} · {row.roomNumber}</td><td className="px-1 py-1.5">{row.phone}<br />{row.email}</td><td className="px-1 py-1.5">{money(row.balance, currency)} · {row.paymentStatus}<br /><span className="font-mono text-slate-500">{row.folioNumbers?.join(', ') || 'No folio'}</span></td><td className="px-1 py-1.5">{row.source}<br />{row.vipStatus}</td><td className="px-1 py-1.5">{row.earlyCheckIn ? 'Early check-in · ' : ''}{row.lateCheckOut ? 'Late checkout · ' : ''}{row.specialRequests}</td></tr>)}</tbody>
            </table>
          </section>
          <div className="border-t-2 border-slate-800 pt-3 text-[9px] text-slate-600"><strong>Control interpretation:</strong> Arrival/departure status is taken from the night-audit movement snapshot where available. Positive balances require collection; pending, no-show, cancelled, and outstanding departures require front-desk follow-up.</div>
        </>}
      </div>
    </A4ReportWrapper>
  );
}
