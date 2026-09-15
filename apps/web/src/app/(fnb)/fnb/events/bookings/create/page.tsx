import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EventWizard } from '@/components/events/EventWizard';
import { prisma } from '@hotel-pms/db';

export const metadata: Metadata = {
  title: 'Create Booking | LodgeCore',
};

export default async function CreateEventBookingPage({ searchParams }: { searchParams: { type?: string } }) {
  const type = searchParams.type || 'full';
  
  const halls = await prisma.hall.findMany({ orderBy: { name: 'asc' } });
  const packages = await prisma.banquetPackage.findMany({ orderBy: { name: 'asc' } });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Event Booking</h1>
        <p className="text-muted-foreground mt-1">Wizard for creating a new booking, assigning halls, and generating BEOs.</p>
      </div>

      <EventWizard initialHalls={halls} initialPackages={packages} bookingType={type} />
    </div>
  );
}
