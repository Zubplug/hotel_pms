import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { HallForm, HallScheduleLink } from '@/components/events/CatalogControls';

export const metadata: Metadata = {
  title: 'Halls Management | LodgeCore',
};

export default async function HallsPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) throw new Error('No property is assigned to this account.');

  const halls = await prisma.hall.findMany({
    where: { propertyId },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Halls & Spaces</h1>
          <p className="text-muted-foreground mt-1">Manage physical event spaces, capacities, and base lease pricing.</p>
        </div>
        <div className="flex gap-2">
          <HallForm />
        </div>
      </div>

      {halls.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <CardHeader>
            <CardTitle>No Halls Found</CardTitle>
            <CardDescription>Get started by adding your first event space or banquet hall.</CardDescription>
          </CardHeader>
          <CardContent>
            <HallForm />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {halls.map(hall => (
            <Card key={hall.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle>{hall.name}</CardTitle>
                  <CardDescription>Code: {hall.code}</CardDescription>
                </div>
                {hall.isActive && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2 mt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capacity:</span>
                    <span className="font-medium">{hall.capacity} pax</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size:</span>
                    <span className="font-medium">{hall.squareMeters?.toString() || '--'} sqm</span>
                  </div>
                </div>
                <div className="mt-6 flex gap-2">
                  <HallForm hall={{ id: hall.id, name: hall.name, code: hall.code, capacity: hall.capacity, rate: hall.rate?.toString() || null }} />
                  <HallScheduleLink hallId={hall.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
