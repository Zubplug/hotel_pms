'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ReservationForm } from '@/components/reservations/ReservationForm';

export default function NewReservationPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 -mt-0.5">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Reservation</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create a new booking for a guest.
        </p>
      </div>

      <ReservationForm />
    </div>
  );
}
