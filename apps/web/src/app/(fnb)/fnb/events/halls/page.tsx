import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@hotel-pms/db';
import { requireEventContext } from '@/lib/events/access';
import { HallForm, HallScheduleLink } from '@/components/events/CatalogControls';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, LayoutGrid, Plus, Ruler, Sparkles, Tags, Users } from 'lucide-react';

export const metadata: Metadata = { title: 'Halls & Spaces | LodgeCore' };

const money = (value: number) => value ? `₦${Math.round(value).toLocaleString('en-NG')}` : 'Not priced';

export default async function HallsPage() {
  const { propertyId } = await requireEventContext();
  const today = new Date();
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + 30);
  const [halls, bookings] = await Promise.all([
    prisma.hall.findMany({ where: { propertyId }, orderBy: { name: 'asc' } }),
    prisma.eventBooking.findMany({ where: { hall: { propertyId }, startTime: { gte: today, lt: horizon }, status: { not: 'CANCELLED' } }, select: { hallId: true } }),
  ]);
  const activeHalls = halls.filter((hall) => hall.isActive);
  const totalCapacity = activeHalls.reduce((sum, hall) => sum + hall.capacity, 0);
  const pricedHalls = activeHalls.filter((hall) => hall.rate !== null);
  const averageRate = pricedHalls.length ? pricedHalls.reduce((sum, hall) => sum + Number(hall.rate), 0) / pricedHalls.length : 0;
  const metricCards: Array<{ label: string; value: string; detail: string; icon: LucideIcon }> = [
    { label: 'Active spaces', value: activeHalls.length.toLocaleString(), detail: `${halls.length - activeHalls.length} inactive`, icon: LayoutGrid },
    { label: 'Sellable capacity', value: totalCapacity.toLocaleString(), detail: 'Guests across active halls', icon: Users },
    { label: 'Next 30-day load', value: bookings.length.toLocaleString(), detail: 'Scheduled booking instances', icon: CalendarDays },
    { label: 'Average hall rate', value: money(averageRate), detail: `${pricedHalls.length} of ${activeHalls.length} spaces priced`, icon: Tags },
  ];

  return <div className="min-h-full bg-[#fbf8f6] text-[#24130d]">
    <header className="border-b border-[#3d2318] bg-[#24130d] text-white"><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300"><Sparkles className="h-4 w-4" /> F&B Hall & events</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Halls & spaces</h1><p className="mt-2 max-w-2xl text-sm text-orange-100/75">Maintain the function-space inventory your sales and banquet teams can confidently sell.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" asChild><Link href="/fnb/events/bookings?view=timeline"><CalendarDays className="mr-2 h-4 w-4" /> Open diary</Link></Button><HallForm /></div></div></div></header>
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ label, value, detail, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.05)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876f63]">{label}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-[#947d72]">{detail}</p></div><div className="rounded-xl bg-orange-50 p-3 text-orange-600"><Icon className="h-5 w-5" /></div></div></div>)} </div>
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-orange-200 bg-gradient-to-r from-[#fff3e8] to-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)] sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-sm font-bold text-[#7c2d12]"><CheckCircle2 className="h-4 w-4" /> Booking-safe catalog</div><p className="mt-1 text-xs text-[#947d72]">Capacity and schedule remain the source of truth for the booking flow. Changes here apply to new bookings immediately.</p></div><Link href="/fnb/events/bookings/create" className="inline-flex items-center text-xs font-bold text-orange-700">Test booking flow <ArrowUpRight className="ml-1 h-3 w-3" /></Link></section>
      {halls.length === 0 ? <section className="rounded-2xl border border-dashed border-[#d9c8bd] bg-white p-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Plus className="h-6 w-6" /></div><h2 className="mt-4 text-lg font-bold">Create your first event space</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#947d72]">Add a hall with its code, capacity, and base rate so the team can start selling dates with confidence.</p><div className="mt-5"><HallForm /></div></section> : <section className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-end justify-between gap-4"><div><h2 className="text-base font-bold">Space inventory</h2><p className="mt-1 text-xs text-[#947d72]">{halls.length} configured spaces · booking load shown for the next 30 days</p></div><span className="text-xs text-[#947d72]">Sorted by name</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{halls.map((hall) => { const load = bookings.filter((booking) => booking.hallId === hall.id).length; return <article key={hall.id} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(65,32,19,0.07)] ${hall.isActive ? 'border-[#eadfd8] bg-white' : 'border-dashed border-[#d9c8bd] bg-[#fcfaf8]'}`}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-bold">{hall.name}</h3><span className="rounded bg-[#fff3e8] px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-800">{hall.code}</span></div><p className="mt-1 text-xs text-[#947d72]">{hall.isActive ? 'Available for new bookings' : 'Inactive space'}</p></div><span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${hall.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>{hall.isActive && <CheckCircle2 className="h-4 w-4" />}{hall.isActive ? 'Active' : 'Inactive'}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#fff8f2] p-3"><div className="flex items-center gap-1 text-[10px] text-[#947d72]"><Users className="h-3 w-3" /> Capacity</div><p className="mt-1 text-lg font-bold">{hall.capacity.toLocaleString()}</p><p className="text-[10px] text-[#947d72]">guests</p></div><div className="rounded-xl bg-[#fff8f2] p-3"><div className="flex items-center gap-1 text-[10px] text-[#947d72]"><Ruler className="h-3 w-3" /> Footprint</div><p className="mt-1 text-lg font-bold">{hall.squareMeters ? hall.squareMeters.toString() : '—'}</p><p className="text-[10px] text-[#947d72]">sqm</p></div></div><div className="mt-4 flex items-center justify-between border-b border-[#f0e6e0] pb-4"><div><p className="text-[10px] text-[#947d72]">Base hall rate</p><p className="mt-1 text-sm font-bold">{money(Number(hall.rate || 0))}</p></div><div className="text-right"><p className="text-[10px] text-[#947d72]">Next 30 days</p><p className="mt-1 text-sm font-bold text-orange-700">{load} booking{load === 1 ? '' : 's'}</p></div></div><div className="mt-4 flex gap-2"><HallForm hall={{ id: hall.id, name: hall.name, code: hall.code, capacity: hall.capacity, rate: hall.rate?.toString() || null }} /><HallScheduleLink hallId={hall.id} /></div></article>; })}</div></section>}
    </main>
  </div>;
}
