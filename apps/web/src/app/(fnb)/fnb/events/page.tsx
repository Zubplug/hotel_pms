import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, LayoutList, CheckCircle2, TrendingUp, Clock, AlertCircle, Plus } from 'lucide-react';
import { prisma } from '@hotel-pms/db';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Events Dashboard | LodgeCore',
};

export default async function FnbEventsDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch quick metrics
  const activeEventsCount = await prisma.event.count({
    where: {
      status: { in: ['CONFIRMED', 'IN_SERVICE'] },
      startDate: { gte: today }
    }
  });

  const pendingLeads = await prisma.eventLead.count({
    where: { status: 'NEW' }
  });

  const pipelineCount = await prisma.eventLead.count({
    where: { status: { in: ['PROPOSAL_SENT', 'CONVERTED'] } }
  });

  const pendingBEOs = await prisma.banquetEventOrder.count({
    where: { status: 'DRAFT' }
  });

  // Today's Operational Run-sheet
  const todaysBookings = await prisma.eventBooking.findMany({
    where: {
      startTime: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    },
    include: {
      hall: true,
      event: true
    },
    orderBy: { startTime: 'asc' }
  });

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events & Banquets</h1>
          <p className="text-muted-foreground mt-1">Operational visibility and revenue intelligence.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/fnb/events/crm">View Pipeline</Link>
          </Button>
          <Button asChild>
            <Link href="/fnb/events/bookings/create">
              <Plus className="mr-2 h-4 w-4" /> New Booking
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEventsCount}</div>
            <p className="text-xs text-muted-foreground">Upcoming confirmed events</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingLeads}</div>
            <p className="text-xs text-muted-foreground">Require immediate follow-up</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Revenue Pipeline</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineCount} Deals</div>
            <p className="text-xs text-muted-foreground">Active proposals & won deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Pending BEOs</CardTitle>
            <LayoutList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBEOs}</div>
            <p className="text-xs text-muted-foreground">Require approval or issuance</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational Run-sheet */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Run-sheet</CardTitle>
          <CardDescription>Operational schedule for all halls and event spaces.</CardDescription>
        </CardHeader>
        <CardContent>
          {todaysBookings.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
              <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
              <p>No bookings scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaysBookings.map(booking => (
                <div key={booking.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex flex-col items-center justify-center w-20 shrink-0 text-center">
                    <span className="text-sm font-semibold">{booking.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs text-muted-foreground">to</span>
                    <span className="text-sm font-semibold">{booking.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="w-px h-12 bg-border"></div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{booking.event?.name || 'Booking'}</h4>
                    <p className="text-sm text-muted-foreground">{booking.hall.name}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> {booking.event?.expectedGuests || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" /> 
                      Setup: {booking.setupBufferMinutes}m
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/fnb/events/bookings/${booking.eventId}`}>View BEO</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
