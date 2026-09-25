import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getEquipment } from '@/lib/events/booking-actions';
import { EventTimeline } from '@/components/events/EventTimeline';
import { NewBookingDialog } from '@/components/events/NewBookingDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, ChevronRight, Clock3, FileCheck2, ListFilter, Search, Sparkles, Users, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const metadata: Metadata = { title: 'F&B Hall & Events | LodgeCore' };

const money = (value: number) => `₦${Math.round(value).toLocaleString('en-NG')}`;
const date = (value: Date) => value.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
const shortDate = (value: Date) => value.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });

function statusTone(status: string) {
  return ({ CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200', TENTATIVE: 'bg-amber-50 text-amber-700 ring-amber-200', INQUIRY: 'bg-sky-50 text-sky-700 ring-sky-200', IN_SERVICE: 'bg-violet-50 text-violet-700 ring-violet-200', COMPLETED: 'bg-slate-100 text-slate-600 ring-slate-200', CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200' } as Record<string, string>)[status] || 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default async function EventBookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; hallId?: string; q?: string; status?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) throw new Error('No property is assigned to this account.');

  const query = params.q?.trim() || '';
  const selectedStatus = params.status && params.status !== 'ALL' ? params.status : undefined;
  const now = new Date();
  const horizon = new Date(now); horizon.setDate(horizon.getDate() + 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const events = await prisma.event.findMany({
    where: { propertyId, ...(selectedStatus ? { status: selectedStatus as any } : {}), ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { contactName: { contains: query, mode: 'insensitive' } }] } : {}) },
    orderBy: { startDate: 'asc' }, take: 100,
    include: { bookings: { include: { hall: true }, orderBy: { startTime: 'asc' } }, banquetPackage: true, beos: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const allEvents = await prisma.event.findMany({ where: { propertyId }, select: { id: true, status: true, startDate: true, endDate: true, expectedGuests: true, financialStatus: true, beos: { select: { status: true }, orderBy: { version: 'desc' }, take: 1 } } });
  const invoices = await prisma.eventInvoice.findMany({ where: { event: { propertyId }, createdAt: { gte: monthStart } }, select: { totalAmount: true, paidAmount: true, status: true } });
  const halls = await prisma.hall.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } });
  const packages = await prisma.banquetPackage.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } });
  const equipment = await getEquipment(propertyId);

  const upcoming = allEvents.filter((event) => event.startDate >= now && event.startDate <= horizon && event.status !== 'CANCELLED');
  const activePipeline = allEvents.filter((event) => ['INQUIRY', 'TENTATIVE', 'CONFIRMED'].includes(event.status));
  const confirmedUpcoming = upcoming.filter((event) => event.status === 'CONFIRMED');
  const needsBeo = upcoming.filter((event) => !['APPROVED', 'ISSUED'].includes(event.beos[0]?.status || ''));
  const unpaid = invoices.reduce((sum, invoice) => sum + Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount), 0), 0);
  const monthValue = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const avgGuests = confirmedUpcoming.length ? Math.round(confirmedUpcoming.reduce((sum, event) => sum + event.expectedGuests, 0) / confirmedUpcoming.length) : 0;
  const statusCounts = ['INQUIRY', 'TENTATIVE', 'CONFIRMED', 'IN_SERVICE', 'COMPLETED'].map((status) => ({ status, count: allEvents.filter((event) => event.status === status).length }));
  const maxStatusCount = Math.max(...statusCounts.map((item) => item.count), 1);
  const weekPoints = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(now); start.setDate(now.getDate() - (7 - index) * 7); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return { label: shortDate(start), count: allEvents.filter((event) => event.startDate >= start && event.startDate < end && event.status !== 'CANCELLED').length };
  });
  const maxWeekCount = Math.max(...weekPoints.map((item) => item.count), 1);
  const metricCards: Array<{ label: string; value: string; detail: string; icon: LucideIcon }> = [
    { label: 'Live pipeline', value: activePipeline.length.toLocaleString(), detail: `${upcoming.length} events in next 30 days`, icon: Clock3 },
    { label: 'Confirmed covers', value: confirmedUpcoming.reduce((sum, event) => sum + event.expectedGuests, 0).toLocaleString(), detail: `Avg. ${avgGuests.toLocaleString()} guests / event`, icon: Users },
    { label: 'BEO readiness', value: `${upcoming.length ? Math.round(((upcoming.length - needsBeo.length) / upcoming.length) * 100) : 0}%`, detail: `${needsBeo.length} upcoming event${needsBeo.length === 1 ? '' : 's'} need review`, icon: FileCheck2 },
    { label: 'Open receivables', value: money(unpaid), detail: `${money(monthValue)} invoiced this month`, icon: WalletCards },
  ];
  const selectedHallId = params.hallId;
  const todaysBookings = await prisma.eventBooking.findMany({ where: { hall: { propertyId, ...(selectedHallId ? { id: selectedHallId } : {}) }, startTime: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) } }, include: { event: true }, orderBy: { startTime: 'asc' } });

  return <div className="min-h-full bg-[#fbf8f6] text-[#24130d]">
    <div className="border-b border-[#3d2318] bg-[#24130d] text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300"><Sparkles className="h-4 w-4" /> F&B Hall operations</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Events command centre</h1><p className="mt-2 max-w-2xl text-sm text-orange-100/75">A live operating view from inquiry through BEO approval, service, and settlement.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" asChild><Link href="/fnb/events/bookings?view=timeline"><Calendar className="mr-2 h-4 w-4" /> Schedule</Link></Button><NewBookingDialog initialHalls={halls} initialPackages={packages} equipmentList={equipment} /></div>
        </div>
      </div>
    </div>
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, detail, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876f63]">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight text-[#24130d]">{value}</p><p className="mt-1 text-xs text-[#947d72]">{detail}</p></div><div className="rounded-xl bg-orange-50 p-3 text-orange-600"><Icon className="h-5 w-5" /></div></div></div>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold">Booking momentum</h2><p className="mt-1 text-xs text-[#947d72]">Events created across the last eight weeks</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">Live portfolio</span></div><div className="flex h-44 items-end gap-2 sm:gap-4">{weekPoints.map((point) => <div key={point.label} className="flex h-full flex-1 flex-col justify-end gap-2"><div className="relative flex-1"><div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-gradient-to-t from-orange-600 to-orange-300" style={{ height: `${Math.max(point.count ? (point.count / maxWeekCount) * 100 : 4, 4)}%` }} /><span className="absolute -top-5 inset-x-0 text-center text-[10px] font-semibold text-[#7c2d12]">{point.count || ''}</span></div><span className="text-center text-[10px] text-[#947d72]">{point.label}</span></div>)}</div></section>
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5"><h2 className="text-base font-bold">Pipeline health</h2><p className="mt-1 text-xs text-[#947d72]">Where live event work sits today</p></div><div className="space-y-4">{statusCounts.map((item) => <div key={item.status}><div className="mb-1 flex justify-between text-xs"><span className="font-medium capitalize">{item.status.toLowerCase().replace('_', ' ')}</span><span className="text-[#947d72]">{item.count}</span></div><div className="h-2 rounded-full bg-[#f2e8e2]"><div className="h-2 rounded-full bg-[#c2410c]" style={{ width: `${(item.count / maxStatusCount) * 100}%` }} /></div></div>)}</div></section>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-bold">Upcoming events</h2><p className="mt-1 text-xs text-[#947d72]">Next 30 days · prioritize readiness and guest experience</p></div><Link className="text-xs font-semibold text-orange-700 hover:underline" href="/fnb/events/bookings?status=CONFIRMED">View confirmed <ChevronRight className="inline h-3 w-3" /></Link></div><div className="space-y-2">{upcoming.slice(0, 6).map((event) => <Link key={event.id} href={`/fnb/events/bookings/${event.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f0e6e0] p-3 transition hover:border-orange-300 hover:bg-orange-50/40"><div className="flex min-w-0 items-center gap-3"><div className="w-12 rounded-lg bg-[#fff5ed] px-2 py-2 text-center text-xs font-bold text-orange-700">{shortDate(event.startDate)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{events.find((item) => item.id === event.id)?.name || 'Event booking'}</p><p className="text-xs text-[#947d72]">{event.expectedGuests.toLocaleString()} guests · {events.find((item) => item.id === event.id)?.bookings[0]?.hall.name || 'Hall pending'}</p></div></div><div className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ${statusTone(event.status)}`}>{event.status.replace('_', ' ')}</span>{!['APPROVED', 'ISSUED'].includes(event.beos[0]?.status || '') && <span title="BEO requires attention" className="text-amber-600"><FileCheck2 className="h-4 w-4" /></span>}</div></Link>)}{upcoming.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-[#947d72]">No upcoming events in the next 30 days.</p>}</div></section>
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-[#fff8f2] to-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-center gap-2"><Sparkles className="h-5 w-5 text-orange-600" /><h2 className="text-base font-bold">Manager insights</h2></div><div className="space-y-3 text-sm"><div className="rounded-xl bg-white/80 p-3"><p className="font-semibold text-[#7c2d12]">Readiness queue</p><p className="mt-1 text-xs leading-5 text-[#947d72]">{needsBeo.length ? `${needsBeo.length} upcoming booking${needsBeo.length === 1 ? '' : 's'} need a BEO review before operations handoff.` : 'All upcoming events have an approved or issued BEO.'}</p></div><div className="rounded-xl bg-white/80 p-3"><p className="font-semibold text-[#7c2d12]">Commercial focus</p><p className="mt-1 text-xs leading-5 text-[#947d72]">{unpaid ? `${money(unpaid)} remains open across this month’s event invoices.` : 'No open event receivables were found for this month.'}</p></div><div className="rounded-xl bg-white/80 p-3"><p className="font-semibold text-[#7c2d12]">Demand signal</p><p className="mt-1 text-xs leading-5 text-[#947d72]">{upcoming.length ? `${upcoming.length} event${upcoming.length === 1 ? '' : 's'} are scheduled within the next 30 days across ${halls.length} active hall${halls.length === 1 ? '' : 's'}.` : 'Create or convert an event to start building the forward schedule.'}</p></div></div></section>
      </div>
      <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="text-base font-bold">Event register</h2><p className="mt-1 text-xs text-[#947d72]">Search, filter, and open the live event record.</p></div><form className="flex flex-wrap gap-2" method="get"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#947d72]" /><Input name="q" defaultValue={query} type="search" placeholder="Search event or client" className="w-64 border-[#eadfd8] pl-8" /></div><select name="status" defaultValue={params.status || 'ALL'} className="h-9 rounded-md border border-[#eadfd8] bg-white px-2 text-sm"><option value="ALL">All statuses</option>{['INQUIRY', 'TENTATIVE', 'CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED'].map((status) => <option key={status}>{status}</option>)}</select><Button type="submit" variant="outline"><ListFilter className="mr-2 h-4 w-4" /> Apply</Button></form></div><div className="mt-5 overflow-x-auto rounded-xl border border-[#f0e6e0]"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-[#fffaf7] text-[10px] uppercase tracking-wider text-[#947d72]"><tr><th className="px-4 py-3">Event / client</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Hall</th><th className="px-4 py-3">Guests</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#f0e6e0]">{events.map((event) => <tr key={event.id} className="hover:bg-[#fffaf7]"><td className="px-4 py-3"><p className="font-semibold">{event.name}</p><p className="text-xs text-[#947d72]">{event.contactName}</p></td><td className="px-4 py-3 text-[#6f5d53]">{date(event.startDate)}</td><td className="px-4 py-3 text-[#6f5d53]">{event.bookings.map((booking) => booking.hall.name).join(', ') || '—'}</td><td className="px-4 py-3 text-[#6f5d53]">{event.expectedGuests.toLocaleString()}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ${statusTone(event.status)}`}>{event.status.replace('_', ' ')}</span></td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" asChild><Link href={`/fnb/events/bookings/${event.id}`}>Manage <ChevronRight className="ml-1 h-4 w-4" /></Link></Button></td></tr>)}{events.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#947d72]">No events match the current filters.</td></tr>}</tbody></table></div></section>
      {params.view === 'timeline' && <section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Today&apos;s schedule</h2><Link href="/fnb/events/bookings" className="text-sm font-semibold text-orange-700">Back to register</Link></div><EventTimeline halls={selectedHallId ? halls.filter((hall) => hall.id === selectedHallId) : halls} bookings={todaysBookings} /></section>}
    </main>
  </div>;
}
