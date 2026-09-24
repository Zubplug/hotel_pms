'use client';

import React from 'react';
import { FrontDeskReservationForm } from '@/components/frontdesk/FrontDeskReservationForm';
import { ReservationEntryHeader } from '@/components/frontdesk/ReservationEntryHeader';

export default function NewReservationPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)]">
      <ReservationEntryHeader isWalkIn={false} />
      <div className="mx-auto max-w-[1440px] px-4 py-8 pb-24 sm:px-6 lg:px-8">
        <FrontDeskReservationForm isWalkIn={false} />
      </div>
    </div>
  );
}
