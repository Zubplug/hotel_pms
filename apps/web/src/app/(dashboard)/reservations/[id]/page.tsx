'use client';


import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { ReservationDetail } from '@/components/reservations/ReservationDetail';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ReservationPage() {
  const { id } = useParams() as { id: string };
  const { propertyId } = useProperty();
  const router = useRouter();

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ['reservation', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/reservations/${id}`);
      if (!res.ok) throw new Error('Failed to fetch reservation');
      const data = await res.json();
      return data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Reservation not found or an error occurred.
        </div>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/reservations')}>
          Back to Reservations
        </Button>
      </div>
    );
  }

  // Double check property context matches
  if (propertyId && reservation.propertyId !== propertyId) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          This reservation belongs to a different property. Please switch your active property.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/reservations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reservations
          </Link>
        </Button>
      </div>
      <ReservationDetail reservation={reservation} />
    </div>
  );
}
