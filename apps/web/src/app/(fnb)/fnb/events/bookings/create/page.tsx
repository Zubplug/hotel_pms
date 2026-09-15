import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { prisma } from '@hotel-pms/db';
import { HallOnlyWizard } from '@/components/events/HallOnlyWizard';
import { FullPackageWizard } from '@/components/events/FullPackageWizard';
import { getEquipment } from '@/lib/events/booking-actions';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Create Booking | LodgeCore',
};

export default async function CreateEventBookingPage({ searchParams }: { searchParams: { bookingType?: string } }) {
  const type = searchParams.bookingType;
  
  if (!type || (type !== 'HALL_ONLY' && type !== 'FULL_PACKAGE')) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">What are you booking?</h1>
          <p className="text-muted-foreground mt-1">Select the type of event you are planning to load the correct wizard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Link href="/fnb/events/bookings/create?bookingType=HALL_ONLY">
            <Card className="hover:border-primary transition-colors h-full cursor-pointer">
              <CardHeader>
                <CardTitle>Hall Only</CardTitle>
                <CardDescription>
                  Space rental, meetings, conferences, equipment & add-ons.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/fnb/events/bookings/create?bookingType=FULL_PACKAGE">
            <Card className="hover:border-primary transition-colors h-full cursor-pointer">
              <CardHeader>
                <CardTitle>Full Banquet / Package</CardTitle>
                <CardDescription>
                  Catering, weddings, conferences, menus, packages & event services.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    );
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
