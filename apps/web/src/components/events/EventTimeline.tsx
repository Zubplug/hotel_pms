'use client';

import Link from 'next/link';
import { CalendarClock, ChevronRight, CircleAlert, Clock3, Users } from 'lucide-react';

const START_HOUR = 6;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, index) => START_HOUR + index);

type Hall = { id: string; name: string; code?: string; capacity?: number };
type Booking = {
  id: string;
  eventId: string;
  hallId: string;
  startTime: Date | string;
  endTime: Date | string;
  setupBufferMinutes?: number;
  teardownBufferMinutes?: number;
  status?: string;
  event?: { name?: string; contactName?: string; expectedGuests?: number; status?: string };
};

const statusStyles: Record<string, { bar: string; badge: string; label: string }> = {
  CONFIRMED: { bar: 'border-emerald-300 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800', label: 'Confirmed' },
  TENTATIVE: { bar: 'border-amber-300 bg-amber-50', badge: 'bg-amber-100 text-amber-800', label: 'Tentative' },
  INQUIRY: { bar: 'border-sky-300 bg-sky-50', badge: 'bg-sky-100 text-sky-800', label: 'Inquiry' },
  IN_SERVICE: { bar: 'border-violet-300 bg-violet-50', badge: 'bg-violet-100 text-violet-800', label: 'In service' },
  COMPLETED: { bar: 'border-slate-300 bg-slate-50', badge: 'bg-slate-200 text-slate-700', label: 'Completed' },
};

function clock(value: Date | string) {
  return new Date(value).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function minutesFromStart(value: Date | string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes() - START_HOUR * 60;
}

function blockStyle(startTime: Date | string, endTime: Date | string, before = 0, after = 0, viewDate: Date) {
  const dayStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate()).getTime();
  const start = Math.max(((new Date(startTime).getTime() - dayStart) / 60000) - before, 0);
  const end = Math.min(((new Date(endTime).getTime() - dayStart) / 60000) + after, TOTAL_HOURS * 60);
  return {
    left: `${(start / (TOTAL_HOURS * 60)) * 100}%`,
    width: `${Math.max(((end - start) / (TOTAL_HOURS * 60)) * 100, 1.5)}%`,
  };
}

function isToday(value: Date) {
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth() && value.getDate() === now.getDate();
}

export function EventTimeline({ halls, bookings, viewDate, readOnly = false }: { halls: Hall[]; bookings: Booking[]; viewDate: Date; readOnly?: boolean }) {
  const activeBookings = bookings.filter((booking) => booking.status !== 'CANCELLED' && booking.event?.status !== 'CANCELLED');
  const nowOffset = minutesFromStart(new Date());
  const showNow = isToday(viewDate) && nowOffset >= 0 && nowOffset <= TOTAL_HOURS * 60;
  const board = { shell: 'border-white/10 bg-[#0d1a2d]', sub: 'border-white/10 bg-[#111f34] text-slate-400', header: 'border-white/10 bg-[#111f34] text-slate-400', label: 'border-white/10 bg-[#111f34] text-slate-400', row: 'border-white/10 bg-[#0d1a2d]', grid: 'border-white/10', muted: 'text-slate-500', footer: 'border-white/10 bg-[#111f34] text-slate-400', alert: 'border-orange-300/20 bg-orange-300/[.08] text-orange-200' };

  return <div className={`overflow-hidden rounded-2xl border ${board.shell}`}>
    <div className={`flex items-center justify-between border-b px-4 py-3 text-xs sm:px-5 ${board.sub}`}>
      <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-orange-600" /><span>Local venue time · {START_HOUR.toString().padStart(2, '0')}:00–00:00</span></div>
      <span className="hidden font-medium sm:inline">{activeBookings.length} scheduled event{activeBookings.length === 1 ? '' : 's'}</span>
    </div>
    <div className="overflow-x-auto">
      <div className="min-w-[1180px]">
        <div className={`flex border-b ${board.header}`}>
          <div className={`sticky left-0 z-20 flex w-[230px] flex-none items-center border-r px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] ${board.label}`}>Function space</div>
          <div className="relative flex min-w-0 flex-1">
            {HOURS.map((hour) => <div key={hour} className={`flex-1 border-r px-2 py-3 text-[10px] font-semibold ${board.grid}`}>{hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}</div>)}
            {showNow && <div className="absolute bottom-0 top-0 z-10 w-px bg-orange-500" style={{ left: `${(nowOffset / (TOTAL_HOURS * 60)) * 100}%` }}><span className="absolute -top-1 -translate-x-1/2 rounded-full bg-orange-600 px-1.5 py-0.5 text-[9px] font-bold text-white">NOW</span></div>}
          </div>
        </div>
        {!halls.length ? <div className="px-6 py-16 text-center text-sm text-[#947d72]">No active function spaces are configured.</div> : halls.map((hall) => {
          const hallBookings = activeBookings.filter((booking) => booking.hallId === hall.id);
          return <div key={hall.id} className={`flex min-h-[112px] border-b last:border-b-0 ${board.row}`}>
            <div className={`sticky left-0 z-20 flex w-[230px] flex-none flex-col justify-center border-r bg-[#0d1a2d] px-5 ${board.grid}`}>
              <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-white">{hall.name}</span>{hall.code && <span className="rounded bg-[#fff3e8] px-1.5 py-0.5 text-[9px] font-bold text-orange-800">{hall.code}</span>}</div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400"><Users className="h-3 w-3" /> Capacity {hall.capacity?.toLocaleString() || '—'} · {hallBookings.length} booking{hallBookings.length === 1 ? '' : 's'}</div>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="absolute inset-0 flex">{HOURS.map((hour) => <div key={hour} className={`flex-1 border-r border-dashed ${board.grid}`} />)}</div>
              {hallBookings.length === 0 && <div className={`relative flex h-full items-center px-6 text-xs ${board.muted}`}>Available for new bookings</div>}
              {hallBookings.map((booking) => {
                const style = statusStyles[booking.event?.status || ''] || statusStyles.TENTATIVE;
                const setup = booking.setupBufferMinutes || 0;
                const teardown = booking.teardownBufferMinutes || 0;
                const bookingCard = <div className={`group relative z-10 flex h-full min-w-[150px] flex-col justify-between overflow-hidden rounded-xl border-2 p-2.5 shadow-sm transition ${style.bar}`}>
                  <div className="min-w-0"><div className="flex items-start justify-between gap-2"><p className="truncate text-xs font-bold text-[#24130d]">{booking.event?.name || 'Event booking'}</p>{!readOnly && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50 transition group-hover:translate-x-0.5" />}</div><p className="mt-0.5 truncate text-[10px] text-[#6f5d53]">{booking.event?.contactName || 'Client not specified'}</p></div>
                  <div><div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[#6f5d53]"><span>{clock(booking.startTime)}–{clock(booking.endTime)}</span><span>{booking.event?.expectedGuests?.toLocaleString() || 0} guests</span></div><div className="mt-1 flex items-center gap-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${style.badge}`}>{style.label}</span>{setup + teardown > 0 && <span className="truncate text-[9px] text-[#947d72]">Buffers {setup + teardown}m</span>}</div></div>
                </div>;
                return <div key={booking.id} className="absolute top-3 h-[88px]" style={blockStyle(booking.startTime, booking.endTime, setup, teardown, viewDate)}>
                  <div className="absolute inset-y-0 left-0 right-0 rounded-xl border border-dashed border-slate-300/70 bg-slate-100/50" />
                  {readOnly ? bookingCard : <Link href={`/fnb/events/bookings/${booking.eventId}`} className="relative z-10 block h-full hover:-translate-y-0.5 hover:shadow-md">{bookingCard}</Link>}
                </div>;
              })}
              {showNow && <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-orange-500/70" style={{ left: `${(nowOffset / (TOTAL_HOURS * 60)) * 100}%` }} />}
            </div>
          </div>;
        })}
      </div>
    </div>
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-[10px] sm:px-5 ${board.footer}`}><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Confirmed</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Tentative</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Inquiry</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400 bg-slate-100" /> Setup / teardown buffer</span>{showNow && <span className={`ml-auto flex items-center gap-1.5 font-semibold ${readOnly ? 'text-orange-200' : 'text-orange-700'}`}><Clock3 className="h-3.5 w-3.5" /> Current time</span>}</div>
    {!activeBookings.length && halls.length > 0 && <div className={`flex items-center gap-2 border-t px-5 py-3 text-xs ${board.alert}`}><CircleAlert className="h-4 w-4" /> No active bookings are scheduled for this date. The spaces remain available for new event sales.</div>}
  </div>;
}
