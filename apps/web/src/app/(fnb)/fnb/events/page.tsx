import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, Users, Plus, LayoutList } from 'lucide-react';
import { prisma } from '@hotel-pms/db';

export const metadata: Metadata = {
  title: 'Halls & Events | Event Management',
};

export default async function FnbEventsPage() {
  const events = await prisma.event.findMany({
    orderBy: { startDate: 'asc' },
    include: {
      bookings: {
        include: { hall: true }
      }
    },
    take: 50,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Halls & Events</h1>
          <p className="text-muted-foreground mt-1">Manage banquet halls, event bookings, and packages.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Booking
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-12 text-slate-500">
          <LayoutList className="h-10 w-10 mb-4 opacity-50" />
          <p className="font-semibold">No active events found.</p>
          <p className="text-sm opacity-80 mt-1">Click "New Booking" to create your first event.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const hallNames = event.bookings.map(b => b.hall.name).join(', ') || 'No halls assigned';
            
            return (
              <Card key={event.id} className="hover:shadow-md transition-shadow flex flex-col">
                <CardHeader className="pb-3 flex-none">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg leading-tight">{event.name}</CardTitle>
                    <div className={`px-2 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full shrink-0 ${
                      event.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800  ' :
                      event.status === 'TENTATIVE' ? 'bg-amber-100 text-amber-800  ' :
                      event.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800  ' :
                      event.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800  ' :
                      'bg-slate-100 text-slate-800  '
                    }`}>
                      {event.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                      <span className="leading-snug line-clamp-2">{hallNames}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>{event.startDate.toLocaleDateString()} {event.startDate.getTime() !== event.endDate.getTime() && `- ${event.endDate.toLocaleDateString()}`}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 shrink-0 text-slate-400" />
                      <span>{event.expectedGuests} expected guests</span>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t flex justify-between items-center">
                     <span className="text-xs font-semibold text-slate-500">{event.contactName}</span>
                     <Button variant="outline" size="sm" className="h-8 text-xs">Manage</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
