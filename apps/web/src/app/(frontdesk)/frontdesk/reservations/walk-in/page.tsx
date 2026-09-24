'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { FrontDeskReservationForm } from '@/components/frontdesk/FrontDeskReservationForm';
import { ReservationEntryHeader } from '@/components/frontdesk/ReservationEntryHeader';

export default function WalkInPage() {
  const searchParams = useSearchParams();
  const prefillGuestId = searchParams.get('guestId') ?? undefined;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)]">
      <ReservationEntryHeader isWalkIn isReturningGuest={!!prefillGuestId} />
      <div className="mx-auto max-w-[1440px] px-4 py-8 pb-24 sm:px-6 lg:px-8">
        {prefillGuestId && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">✓</span>
            Returning guest profile linked — available guest credit will be applied after the stay is created.
          </div>
        )}
        <FrontDeskReservationForm isWalkIn={true} prefillGuestId={prefillGuestId} />
      </div>
    </div>
  );
}
