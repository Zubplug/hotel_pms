import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { prisma } from '@hotel-pms/db';
import { HallOnlyWizard } from '@/components/events/HallOnlyWizard';
import { FullPackageWizard } from '@/components/events/FullPackageWizard';
import { BookingTypeSelector } from '@/components/events/BookingTypeSelector';
import { getEquipment } from '@/lib/events/booking-actions';

export const metadata: Metadata = {
  title: 'Create Booking | LodgeCore',
};

export default async function CreateEventBookingPage({ searchParams }: { searchParams: { bookingType?: string } }) {
  const type = searchParams.bookingType;
  
  if (!type || (type !== 'HALL_ONLY' && type !== 'FULL_PACKAGE')) {
    return <BookingTypeSelector />;
  }

  const halls = await prisma.hall.findMany({ orderBy: { name: 'asc' } });
  
  if (type === 'HALL_ONLY') {
    const equipment = await getEquipment();
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Space Rental</h1>
          <p className="text-muted-foreground mt-1">Book halls and equipment.</p>
        </div>
        <HallOnlyWizard initialHalls={halls} equipmentList={equipment} />
      </div>
    );
  }

  const packages = await prisma.banquetPackage.findMany({ orderBy: { name: 'asc' } });
  
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Banquet Event</h1>
        <p className="text-muted-foreground mt-1">Comprehensive event planning for catered events and weddings.</p>
      </div>
      <FullPackageWizard initialHalls={halls} initialPackages={packages} />
    </div>
  );
}
