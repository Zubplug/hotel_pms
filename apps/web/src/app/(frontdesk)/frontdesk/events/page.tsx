'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Info, RefreshCw } from 'lucide-react';
import { EventTimeline } from '@/components/events/EventTimeline';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

type EventScheduleItem = {
  id: string; eventId: string; eventName: string; eventStatus: string; contactName: string;
  expectedGuests: number; hallId: string; hallName: string; hallCode: string; hallCapacity: number;
  startTime: string; endTime: string; setupBufferMinutes: number; teardownBufferMinutes: number;
  status: string;
};
type EventHall = { id: string; name: string; code?: string; capacity?: number };

const displayDate = (date: Date) => date.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function OfflineEventSchedulePage() {
  const { propertyId } = useProperty();
  const { provider, isOnline } = useLodgeCoreProvider();
  const [items, setItems] = useState<EventScheduleItem[]>([]);
  const [halls, setHalls] = useState<EventHall[]>([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!propertyId) return;
    setLoading(true); setError('');
    try {
      const [scheduleResult, hallsResult] = await Promise.all([
        provider.eventSchedule.list(propertyId),
        provider.eventHalls.list(propertyId),
      ]);
      setItems((scheduleResult?.data || scheduleResult || []) as EventScheduleItem[]);
      setHalls((hallsResult?.data || hallsResult || []) as EventHall[]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load the synchronized event schedule.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    if (!propertyId) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [propertyId]);

  const bookings = useMemo(() => items.map((item) => ({
    id: item.id, eventId: item.eventId, hallId: item.hallId, startTime: item.startTime, endTime: item.endTime,
    setupBufferMinutes: item.setupBufferMinutes, teardownBufferMinutes: item.teardownBufferMinutes, status: item.status,
    event: { name: item.eventName, contactName: item.contactName, expectedGuests: item.expectedGuests, status: item.eventStatus },
  })), [items]);
  const selectedBookings = bookings.filter((booking) => {
    const start = new Date(viewDate); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return new Date(booking.startTime) < end && new Date(booking.endTime) > start;
  });
  const previousDate = new Date(viewDate); previousDate.setDate(previousDate.getDate() - 1);
  const nextDate = new Date(viewDate); nextDate.setDate(nextDate.getDate() + 1);
  const today = new Date();
  const expectedCovers = selectedBookings.reduce((total, booking) => total + (booking.event.expectedGuests || 0), 0);
  const firstStart = selectedBookings.length ? new Date(Math.min(...selectedBookings.map((booking) => new Date(booking.startTime).getTime()))) : null;
  const lastFinish = selectedBookings.length ? new Date(Math.max(...selectedBookings.map((booking) => new Date(booking.endTime).getTime()))) : null;
  const operatingWindow = firstStart && lastFinish
    ? `${firstStart.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })} – ${lastFinish.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`
    : 'No scheduled events';
  const handoffMinutes = selectedBookings.reduce((total, booking) => total + booking.setupBufferMinutes + booking.teardownBufferMinutes, 0);

  return <div className="min-h-full bg-[#07111f] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#172348] via-[#10182d] to-[#0c1221] p-6 shadow-[0_24px_80px_-36px_rgba(99,102,241,.55)]">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-cyan-300"><CalendarDays className="h-4 w-4" /> Front Desk · Read-only</div><h1 className="text-3xl font-black tracking-tight">Event schedule</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">The same hall timeline used by F&B, available here from the last synchronized local snapshot.</p></div><div className="flex items-center gap-2"><button onClick={() => setViewDate(previousDate)} className="rounded-xl border border-white/10 bg-white/5 p-2.5 hover:bg-white/10" aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setViewDate(today)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold hover:bg-white/10">Today</button><button onClick={() => setViewDate(nextDate)} className="rounded-xl border border-white/10 bg-white/5 p-2.5 hover:bg-white/10" aria-label="Next day"><ChevronRight className="h-4 w-4" /></button><button onClick={() => void load()} className="ml-1 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2.5 text-cyan-200 hover:bg-cyan-400/20" disabled={loading} aria-label="Refresh schedule"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></div>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/[.06] px-4 py-3 text-xs text-cyan-100"><span className="flex items-center gap-2"><Info className="h-4 w-4 shrink-0 text-cyan-300" />{isOnline ? 'Latest synchronized event schedule.' : 'Offline mode: showing the last synchronized snapshot.'}</span><span className="font-semibold text-cyan-200">{displayDate(viewDate)}</span></div>
      {error && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {loading ? <div className="rounded-3xl border border-white/10 bg-white/[.03] p-16 text-center text-slate-400">Loading synchronized schedule…</div> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Scheduled events', String(selectedBookings.length), `Across ${halls.length} active space${halls.length === 1 ? '' : 's'}`],
            ['Expected covers', String(expectedCovers), 'Guests scheduled to arrive'],
            ['Operating window', operatingWindow, 'First start · last finish'],
            ['Handoff buffers', `${handoffMinutes}m`, 'Setup and teardown protected'],
          ].map(([label, value, hint], index) => <div key={label} className={`rounded-2xl border px-4 py-4 ${index === 3 ? 'border-orange-300/30 bg-orange-300/[.08]' : 'border-white/10 bg-white/[.04]'}`}><p className={`text-[10px] font-black uppercase tracking-[.16em] ${index === 3 ? 'text-orange-200' : 'text-slate-400'}`}>{label}</p><p className={`mt-2 ${label === 'Operating window' && value === 'No scheduled events' ? 'text-lg' : 'text-2xl'} font-black ${index === 3 ? 'text-orange-100' : 'text-white'}`}>{value}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></div>)}
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1a2d] p-3 shadow-[0_24px_80px_-36px_rgba(34,211,238,.28)] sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-white">{displayDate(viewDate)}</h2><p className="mt-1 text-xs text-slate-400">Read-only venue operations · {selectedBookings.length} scheduled event{selectedBookings.length === 1 ? '' : 's'}</p></div><Link href="/frontdesk" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-white/10">Back to Front Desk</Link></div><EventTimeline halls={halls} bookings={selectedBookings} viewDate={viewDate} readOnly /></div>
      </>}
    </div>
  </div>;
}
