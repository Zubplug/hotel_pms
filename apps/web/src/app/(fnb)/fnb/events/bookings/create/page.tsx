import { Metadata } from 'next';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'What are you booking? | LodgeCore',
};

export default function BookingTypeSelectorPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">What are you booking?</h1>
        <p className="text-muted-foreground mt-1">Select the type of event you are planning to load the correct wizard.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Link href="/fnb/events/bookings/create/hall-only">
          <Card className="hover:border-primary transition-colors h-full cursor-pointer">
            <CardHeader>
              <CardTitle>Hall Only</CardTitle>
              <CardDescription>
                Space rental, meetings, conferences, equipment & add-ons.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/fnb/events/bookings/create/full-package">
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
