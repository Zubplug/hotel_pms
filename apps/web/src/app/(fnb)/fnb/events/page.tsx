import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@hotel-pms/db';
import { requireEventContext } from '@/lib/events/access';
import { getEquipment } from '@/lib/events/booking-actions';
import { NewBookingDialog } from '@/components/events/NewBookingDialog';
import { ArrowUpRight, BarChart3, Calendar, CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, LayoutGrid, Package, Sparkles, Users, WalletCards } from 'lucide-react';

export const metadata: Metadata = { title: 'F&B Events Command Centre | LodgeCore' };

const money = (value: number) => `₦${Math.round(value).toLocaleString('en-NG')}`;
const dayLabel = (value: Date) => value.toLocaleDateString('en-NG', { weekday: 'short', day: '2-digit', month: 'short' });
const statusColor: Record<string, string> = {
  INQUIRY: 'bg-sky-50 text-sky-700 ring-sky-200',
  TENTATIVE: 'bg-amber-50 text-amber-700 ring-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  IN_SERVICE: 'bg-violet-50 text-violet-700 ring-violet-200',
  COMPLETED: 'bg-slate-100 text-slate-600 ring-slate-200',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default async function FnbEventsDashboard() {
  const { propertyId } = await requireEventContext();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const next30 = new Date(today); next30.setDate(next30.getDate() + 30);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const eightWeeksAgo = new Date(today); eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [events, leads, invoices, todaysBookings, halls, packages, equipment, guests, corporateAccounts] = await Promise.all([
    prisma.event.findMany({ where: { propertyId }, orderBy: { startDate: 'asc' }, include: { bookings: { include: { hall: true }, orderBy: { startTime: 'asc' } }, beos: { orderBy: { version: 'desc' }, take: 1 } } }),
    prisma.eventLead.findMany({ where: { propertyId }, orderBy: { createdAt: 'desc' } }),
    prisma.eventInvoice.findMany({ where: { event: { propertyId }, createdAt: { gte: monthStart } }, select: { totalAmount: true, paidAmount: true, status: true } }),
    prisma.eventBooking.findMany({ where: { hall: { propertyId }, startTime: { gte: today, lt: tomorrow } }, include: { hall: true, event: true }, orderBy: { startTime: 'asc' } }),
    prisma.hall.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.banquetPackage.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } }),
    getEquipment(propertyId),
    prisma.guest.findMany({ where: { propertyId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: 'asc' }, take: 200 }),
    prisma.corporateAccount.findMany({ where: { propertyId, isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' }, take: 200 }),
  ]);

  const activeEvents = events.filter((event) => ['CONFIRMED', 'IN_SERVICE'].includes(event.status) && event.startDate >= today);
  const upcoming = events.filter((event) => event.startDate >= today && event.startDate < next30 && event.status !== 'CANCELLED');
  const confirmedUpcoming = upcoming.filter((event) => event.status === 'CONFIRMED');
  const openLeads = leads.filter((lead) => !['CONVERTED', 'LOST'].includes(lead.status));
  const newLeads = leads.filter((lead) => lead.status === 'NEW');
  const wonLeads = leads.filter((lead) => lead.status === 'CONVERTED');
  const conversionRate = leads.length ? Math.round((wonLeads.length / leads.length) * 100) : 0;
  const pendingBeos = upcoming.filter((event) => !['APPROVED', 'ISSUED'].includes(event.beos[0]?.status || ''));
  const invoiceValue = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const receivables = invoices.reduce((sum, invoice) => sum + Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount), 0), 0);
  const upcomingGuests = confirmedUpcoming.reduce((sum, event) => sum + event.expectedGuests, 0);
  const averageEventSize = confirmedUpcoming.length ? Math.round(upcomingGuests / confirmedUpcoming.length) : 0;
  const bookedByHall = halls.map((hall) => ({ hall, bookings: events.filter((event) => event.status !== 'CANCELLED' && event.bookings.some((booking) => booking.hallId === hall.id && booking.startTime >= today && booking.startTime < next30)).length }));
  const maxHallBookings = Math.max(...bookedByHall.map((item) => item.bookings), 1);
  const weeklyDemand = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(eightWeeksAgo); start.setDate(eightWeeksAgo.getDate() + index * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    return { label: start.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' }), count: events.filter((event) => event.createdAt >= start && event.createdAt < end && event.status !== 'CANCELLED').length };
  });
  const maxDemand = Math.max(...weeklyDemand.map((point) => point.count), 1);
  const pipeline = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'CONVERTED'].map((status) => ({ status, count: leads.filter((lead) => lead.status === status).length }));
  const maxPipeline = Math.max(...pipeline.map((item) => item.count), 1);

  return <div className="min-h-full bg-[#fbf8f6] text-[#24130d]">
    <header className="border-b border-[#3d2318] bg-[#24130d] text-white"><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300"><Sparkles className="h-4 w-4" /> F&B Hall & events</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Events command centre</h1><p className="mt-2 max-w-2xl text-sm text-orange-100/75">One live view of demand, venue capacity, BEO readiness, event revenue, and the next operational handoff.</p></div><NewBookingDialog initialHalls={halls} initialPackages={packages} equipmentList={equipment} guests={guests} corporateAccounts={corporateAccounts} /></div></div></header>
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Forward events', value: upcoming.length.toLocaleString(), detail: `${upcomingGuests.toLocaleString()} confirmed covers in 30 days`, icon: Calendar },
          { label: 'Sales pipeline', value: openLeads.length.toLocaleString(), detail: `${newLeads.length} new inquiries need follow-up`, icon: Users },
          { label: 'BEO readiness', value: `${upcoming.length ? Math.round(((upcoming.length - pendingBeos.length) / upcoming.length) * 100) : 0}%`, detail: `${pendingBeos.length} upcoming event${pendingBeos.length === 1 ? '' : 's'} need review`, icon: FileCheck2 },
          { label: 'Open receivables', value: money(receivables), detail: `${money(invoiceValue)} invoiced this month`, icon: WalletCards },
        ].map(({ label, value, detail, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876f63]">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-[#947d72]">{detail}</p></div><div className="rounded-xl bg-orange-50 p-3 text-orange-600"><Icon className="h-5 w-5" /></div></div></div>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold">Demand momentum</h2><p className="mt-1 text-xs text-[#947d72]">Event records created across the last eight weeks</p></div><BarChart3 className="h-5 w-5 text-orange-500" /></div><div className="flex h-48 items-end gap-2 sm:gap-4">{weeklyDemand.map((point) => <div key={point.label} className="flex h-full flex-1 flex-col justify-end gap-2"><div className="relative flex-1"><div className="absolute inset-x-0 bottom-0 rounded-t-lg bg-gradient-to-t from-orange-600 to-orange-300" style={{ height: `${Math.max(point.count ? (point.count / maxDemand) * 100 : 4, 4)}%` }} /><span className="absolute -top-5 inset-x-0 text-center text-[10px] font-semibold text-[#7c2d12]">{point.count || ''}</span></div><span className="text-center text-[10px] text-[#947d72]">{point.label}</span></div>)}</div></section>
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5"><h2 className="text-base font-bold">Inquiry conversion</h2><p className="mt-1 text-xs text-[#947d72]">Live sales funnel from CRM</p></div><div className="space-y-4">{pipeline.map((item) => <div key={item.status}><div className="mb-1 flex justify-between text-xs"><span className="font-medium capitalize">{item.status.toLowerCase().replace('_', ' ')}</span><span className="text-[#947d72]">{item.count}</span></div><div className="h-2 rounded-full bg-[#f2e8e2]"><div className="h-2 rounded-full bg-[#c2410c]" style={{ width: `${(item.count / maxPipeline) * 100}%` }} /></div></div>)}<div className="mt-5 flex items-center justify-between rounded-xl bg-[#fff8f2] p-3"><span className="text-xs text-[#947d72]">Lead-to-converted rate</span><span className="text-lg font-bold text-[#7c2d12]">{conversionRate}%</span></div></div></section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-base font-bold">Venue load · next 30 days</h2><p className="mt-1 text-xs text-[#947d72]">Bookings by active hall, based on scheduled event records</p></div><LayoutGrid className="h-5 w-5 text-orange-500" /></div><div className="space-y-4">{bookedByHall.map(({ hall, bookings }) => <div key={hall.id}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{hall.name}<span className="ml-2 font-normal text-[#947d72]">capacity {hall.capacity}</span></span><span className="text-[#947d72]">{bookings} booking{bookings === 1 ? '' : 's'}</span></div><div className="h-3 rounded-full bg-[#f2e8e2]"><div className="h-3 rounded-full bg-gradient-to-r from-orange-300 to-orange-600" style={{ width: `${Math.max((bookings / maxHallBookings) * 100, bookings ? 8 : 0)}%` }} /></div></div>)}{!halls.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-[#947d72]">No active halls configured.</p>}</div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#fff8f2] p-3"><p className="text-xs text-[#947d72]">Average confirmed event</p><p className="mt-1 text-lg font-bold">{averageEventSize.toLocaleString()} guests</p></div><div className="rounded-xl bg-[#fff8f2] p-3"><p className="text-xs text-[#947d72]">Active upcoming bookings</p><p className="mt-1 text-lg font-bold">{activeEvents.length.toLocaleString()}</p></div></div></section>
        <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-[#fff8f2] to-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-center gap-2"><Sparkles className="h-5 w-5 text-orange-600" /><h2 className="text-base font-bold">Manager insights</h2></div><div className="space-y-3 text-sm"><div className="rounded-xl bg-white/80 p-3"><p className="font-semibold text-[#7c2d12]">Sales attention</p><p className="mt-1 text-xs leading-5 text-[#947d72]">{newLeads.length ? `${newLeads.length} new lead${newLeads.length === 1 ? '' : 's'} are waiting for first contact.` : 'No new leads are waiting for first contact.'}</p><Link href="/fnb/events/crm" className="mt-2 inline-flex items-center text-xs font-semibold text-orange-700">Open CRM <ArrowUpRight className="ml-1 h-3 w-3" /></Link></div><div className="rounded-xl bg-white/80 p-3"><p className="font-semibold text-[#7c2d12]">Operations readiness</p><p className="mt-1 text-xs leading-5 text-[#947d72]">{pendingBeos.length ? `${pendingBeos.length} upcoming booking${pendingBeos.length === 1 ? '' : 's'} need a BEO review before the operational handoff.` : 'All upcoming events have an approved or issued BEO.'}</p></div><div className="rounded-xl bg-white/80 p-3"><p className="font-semibold text-[#7c2d12]">Commercial exposure</p><p className="mt-1 text-xs leading-5 text-[#947d72]">{receivables ? `${money(receivables)} remains open across this month’s event invoices.` : 'No open event receivables found for this month.'}</p><Link href="/fnb/events/accounting" className="mt-2 inline-flex items-center text-xs font-semibold text-orange-700">Review accounting <ArrowUpRight className="ml-1 h-3 w-3" /></Link></div></div></section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-bold">Today&apos;s operational handoff</h2><p className="mt-1 text-xs text-[#947d72]">Live schedule across all halls and event spaces</p></div><Link href="/fnb/events/bookings?view=timeline" className="text-xs font-semibold text-orange-700">Open schedule <ChevronRight className="inline h-3 w-3" /></Link></div><div className="space-y-2">{todaysBookings.map((booking) => <Link key={booking.id} href={`/fnb/events/bookings/${booking.eventId}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f0e6e0] p-3 transition hover:border-orange-300 hover:bg-orange-50/40"><div className="flex items-center gap-3"><div className="w-20 text-center text-xs font-bold text-orange-700">{booking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<span className="mx-1 text-[#c7b5aa]">→</span>{booking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div><div className="h-9 w-px bg-[#eadfd8]" /><div><p className="text-sm font-semibold">{booking.event?.name || 'Booking'}</p><p className="text-xs text-[#947d72]">{booking.hall.name} · {booking.event?.expectedGuests || 0} guests · setup {booking.setupBufferMinutes}m</p></div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ${statusColor[booking.event?.status || ''] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{booking.event?.status?.replace('_', ' ') || 'Scheduled'}</span></Link>)}{!todaysBookings.length && <div className="flex flex-col items-center rounded-xl border border-dashed p-8 text-center text-[#947d72]"><CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500/40" /><p className="text-sm">No bookings scheduled for today.</p></div>}</div></section>
        <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-4"><h2 className="text-base font-bold">Event workspace</h2><p className="mt-1 text-xs text-[#947d72]">Go directly to the control surface you need.</p></div><div className="grid gap-2">{[{ href: '/fnb/events/crm', label: 'CRM & inquiries', detail: `${openLeads.length} open leads`, icon: Users }, { href: '/fnb/events/bookings', label: 'Bookings & calendar', detail: `${events.length} event records`, icon: Calendar }, { href: '/fnb/events/accounting', label: 'Accounting & deposits', detail: `${money(receivables)} open`, icon: CircleDollarSign }, { href: '/fnb/events/halls', label: 'Halls & spaces', detail: `${halls.length} active halls`, icon: LayoutGrid }, { href: '/fnb/events/packages', label: 'Packages & equipment', detail: `${packages.length} packages · ${equipment.length} equipment`, icon: Package }].map(({ href, label, detail, icon: Icon }) => <Link key={href} href={href} className="flex items-center justify-between rounded-xl border border-[#f0e6e0] p-3 transition hover:border-orange-300 hover:bg-orange-50/40"><div className="flex items-center gap-3"><div className="rounded-lg bg-orange-50 p-2 text-orange-600"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-[#947d72]">{detail}</p></div></div><ChevronRight className="h-4 w-4 text-[#947d72]" /></Link>)}</div></section>
      </div>
    </main>
  </div>;
}
