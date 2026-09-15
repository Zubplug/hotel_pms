import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings2, CheckCircle2 } from 'lucide-react';
import { prisma } from '@hotel-pms/db';

export const metadata: Metadata = {
  title: 'Halls Management | LodgeCore',
};

export default async function HallsPage() {
  const halls = await prisma.hall.findMany({
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
          <Button variant="outline"><Settings2 className="mr-2 h-4 w-4" /> Configure Rates</Button>
          <Button><Plus className="mr-2 h-4 w-4" /> Add Hall</Button>
        </div>
      </div>

      {halls.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <CardHeader>
            <CardTitle>No Halls Found</CardTitle>
            <CardDescription>Get started by adding your first event space or banquet hall.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Hall</Button>
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
                  <Button variant="outline" size="sm" className="w-full">Edit</Button>
                  <Button variant="secondary" size="sm" className="w-full">View Schedule</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
