'use client';

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export function BookingTypeSelector() {
  const router = useRouter();

  const handleSelect = (type: string) => {
    router.push(`/fnb/events/bookings/create?bookingType=${type}`);
    router.refresh();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">What are you booking?</h1>
        <p className="text-muted-foreground mt-1">Select the type of event you are planning to load the correct wizard.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div onClick={() => handleSelect('HALL_ONLY')}>
          <Card className="hover:border-primary transition-colors h-full cursor-pointer">
            <CardHeader>
              <CardTitle>Hall Only</CardTitle>
              <CardDescription>
                Space rental, meetings, conferences, equipment & add-ons.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div onClick={() => handleSelect('FULL_PACKAGE')}>
          <Card className="hover:border-primary transition-colors h-full cursor-pointer">
            <CardHeader>
              <CardTitle>Full Banquet / Package</CardTitle>
              <CardDescription>
                Catering, weddings, conferences, menus, packages & event services.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
