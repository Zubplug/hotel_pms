'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FrontDeskReservationDetail } from '@/components/frontdesk/FrontDeskReservationDetail';

export default function FrontDeskReservationPage() {
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="p-8 max-w-5xl mx-auto mt-12">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 font-medium">
          Reservation not found or an error occurred.
        </div>
        <Button variant="outline" className="mt-6 rounded-xl h-12 px-6" onClick={() => router.push('/frontdesk/reservations')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search
        </Button>
      </div>
    );
  }

  if (propertyId && reservation.propertyId !== propertyId) {
    return (
      <div className="p-8 max-w-5xl mx-auto mt-12">
        <div className="bg-amber-50 text-amber-700 p-6 rounded-2xl border border-amber-100 font-medium">
          This reservation belongs to a different property. Please switch your active property.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pb-24">
      <div className="max-w-5xl mx-auto mb-8 animate-in slide-in-from-left-4 duration-500">
        <Button 
          variant="outline" 
          onClick={() => router.push('/frontdesk')} 
          className="rounded-full h-10 px-4 shadow-sm border-slate-200 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Front Desk
        </Button>
      </div>
      
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
        <FrontDeskReservationDetail reservation={reservation} />
      </div>
    </div>
  );
}
