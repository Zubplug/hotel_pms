'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { FrontDeskReservationForm } from '@/components/frontdesk/FrontDeskReservationForm';

export default function NewReservationPage() {
  const router = useRouter();

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen pb-24">
      {/* Header */}
      <div className="flex items-center gap-6 mb-10 animate-in slide-in-from-left-4 duration-500">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => router.push('/frontdesk')} 
          className="rounded-full w-12 h-12 shadow-sm border-slate-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">New Reservation</h1>
          <p className="text-slate-500 mt-1 font-medium">Create a booking for a future date.</p>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        <FrontDeskReservationForm isWalkIn={false} />
      </div>
    </div>
  );
}
