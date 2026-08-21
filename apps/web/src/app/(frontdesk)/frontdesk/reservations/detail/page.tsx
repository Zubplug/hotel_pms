'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FrontDeskReservationDetail } from '@/components/frontdesk/FrontDeskReservationDetail';

function ReservationDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  const router = useRouter();

  const { data: res, isLoading, error } = useQuery({
    queryKey: ['reservation', id],
    queryFn: async () => {
      if (!id) throw new Error("No ID");
      return provider.reservations.get(id);
    },
    enabled: !!id,
  });

  const reservation = res?.data || res;

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

export default function FrontDeskReservationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    }>
      <ReservationDetailContent />
    </Suspense>
  );
}
