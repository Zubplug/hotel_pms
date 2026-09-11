import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin, Users, Plus } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Halls & Events | Event Management',
};

const mockEvents = [
  { name: 'Tech Innovators Summit', hall: 'Grand Ballroom', date: 'Oct 24, 2026', guests: 250, status: 'CONFIRMED' },
  { name: 'Smith Wedding Reception', hall: 'Crystal Hall', date: 'Oct 28, 2026', guests: 120, status: 'TENTATIVE' },
  { name: 'Corporate Board Retreat', hall: 'Meeting Room A', date: 'Nov 02, 2026', guests: 15, status: 'INQUIRY' },
];

export default function FnbEventsPage() {
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockEvents.map((event, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{event.name}</CardTitle>
                <div className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  event.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                  event.status === 'TENTATIVE' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {event.status}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{event.hall}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{event.guests} expected guests</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
