import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@hotel-pms/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateBEO } from '@/lib/events/event-actions';
import { requireEventContext } from '@/lib/events/access';

export const metadata: Metadata = { title: 'Event Booking | LodgeCore' };

export default async function EventBookingDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { propertyId, userId } = await requireEventContext();
  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, propertyId },
    include: {
      bookings: { include: { hall: true, equipmentBookings: { include: { equipment: true } } }, orderBy: { startTime: 'asc' } },
      banquetPackage: { include: { items: true } },
      beos: { orderBy: { version: 'desc' } },
      changeOrders: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!event) notFound();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="link" asChild className="-ml-4 px-4"><Link href="/fnb/events/bookings">← Back to bookings</Link></Button>
          <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
          <p className="mt-1 text-muted-foreground">{event.status} · {event.contactName} · {event.expectedGuests} guests</p>
        </div>
        {event.status !== 'CANCELLED' && (
          <form action={generateBEO.bind(null, event.id, userId)}>
            <Button type="submit">Generate BEO</Button>
          </form>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {event.bookings.map(booking => (
              <div key={booking.id} className="rounded-lg border p-4">
                <div className="font-medium">{booking.hall.name}</div>
                <div className="text-sm text-muted-foreground">{booking.startTime.toLocaleString()} – {booking.endTime.toLocaleString()}</div>
                <div className="mt-2 text-xs text-muted-foreground">Setup {booking.setupBufferMinutes}m · Teardown {booking.teardownBufferMinutes}m</div>
                {booking.equipmentBookings.length > 0 && <div className="mt-2 text-sm">Equipment: {booking.equipmentBookings.map(item => `${item.equipment.name} × ${item.quantity}`).join(', ')}</div>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Package & BEO versions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">Package: {event.banquetPackage?.name || 'Hall only'}</p>
            {event.beos.length === 0 ? <p className="text-sm text-muted-foreground">No BEO generated yet.</p> : event.beos.map(beo => (
              <div key={beo.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <span>Version {beo.version} · {beo.status}</span>
                <span className="text-muted-foreground">{beo.createdAt.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Change orders</CardTitle></CardHeader>
        <CardContent>
          {event.changeOrders.length === 0 ? <p className="text-sm text-muted-foreground">No change orders.</p> : <div className="space-y-2">{event.changeOrders.map(order => <div key={order.id} className="rounded border p-3 text-sm"><div className="font-medium">{order.status}</div><div>{order.description}</div></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
