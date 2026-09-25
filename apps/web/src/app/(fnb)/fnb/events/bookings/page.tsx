import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ListFilter, Calendar, Search } from 'lucide-react';
import { prisma } from '@hotel-pms/db';

import Link from 'next/link';
import { EventTimeline } from '@/components/events/EventTimeline';
import { auth } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Event Bookings | LodgeCore',
};

export default async function EventBookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; hallId?: string; q?: string; status?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const isTimeline = resolvedSearchParams.view === 'timeline';
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) throw new Error('No property is assigned to this account.');
  
  const query = resolvedSearchParams.q?.trim() || '';
  const status = resolvedSearchParams.status;
  const events = await prisma.event.findMany({
    where: {
      propertyId,
      ...(status && status !== 'ALL' ? { status: status as any } : {}),
      ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { contactName: { contains: query, mode: 'insensitive' } }] } : {}),
    },
    orderBy: { startDate: 'asc' },
    include: {
      bookings: { include: { hall: true } }
    },
    take: 50,
  });

  const selectedHallId = resolvedSearchParams.hallId;
  const halls = await prisma.hall.findMany({ where: { propertyId, ...(selectedHallId ? { id: selectedHallId } : {}) }, orderBy: { name: 'asc' } });
  
  // For timeline, fetch today's bookings explicitly
  const today = new Date();
  today.setHours(0,0,0,0);
  const todaysBookings = await prisma.eventBooking.findMany({
    where: {
      hall: { propertyId, ...(selectedHallId ? { id: selectedHallId } : {}) },
      startTime: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    include: { event: true }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Bookings</h1>
          <p className="text-muted-foreground mt-1">Manage all event schedules, BEOs, and operational details.</p>
        </div>
        <div className="flex gap-2">
          {isTimeline ? (
            <Button variant="outline" asChild><Link href="/fnb/events/bookings"><ListFilter className="mr-2 h-4 w-4" /> List View</Link></Button>
          ) : (
            <Button variant="outline" asChild><Link href="/fnb/events/bookings?view=timeline"><Calendar className="mr-2 h-4 w-4" /> Timeline View</Link></Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <form className="flex gap-2" method="get">
              <input type="hidden" name="view" value={isTimeline ? 'timeline' : ''} />
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input name="q" defaultValue={query} type="search" placeholder="Search bookings..." className="pl-8" />
              </div>
              <select name="status" defaultValue={status || 'ALL'} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="ALL">All statuses</option><option value="TENTATIVE">Tentative</option><option value="CONFIRMED">Confirmed</option><option value="IN_SERVICE">In service</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select>
              <Button type="submit" variant="outline">Apply</Button>
            </form>
            <Button asChild>
              <Link href="/fnb/events/bookings/create">
                <Plus className="mr-2 h-4 w-4" /> New Booking
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {isTimeline ? (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Today's Schedule</h2>
          <EventTimeline halls={halls} bookings={todaysBookings} />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle>All Bookings</CardTitle>
              <CardDescription>List of all tentative and confirmed events.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Event Name</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Halls</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No bookings found.
                      </td>
                    </tr>
                  ) : (
                    events.map(event => (
                      <tr key={event.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{event.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {event.startDate.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">{event.contactName}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {event.bookings.map(b => b.hall.name).join(', ') || '--'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
                            {event.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" asChild><Link href={`/fnb/events/bookings/${event.id}`}>Manage</Link></Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
