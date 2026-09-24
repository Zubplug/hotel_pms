'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Loader2, ArrowLeft, UserRound, BedDouble, ShieldCheck } from 'lucide-react';
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
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const reservation = res?.data || res;

  if (!id || id === 'undefined') {
    return (
      <div className="p-8 max-w-5xl mx-auto mt-12">
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 font-medium">
          Reservation could not be loaded. Missing or invalid reservation ID.
        </div>
        <Button variant="outline" className="mt-6 rounded-xl h-12 px-6" onClick={() => router.push('/frontdesk/reservations')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !reservation || reservation.error) {
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

  if (propertyId && reservation.propertyId && reservation.propertyId !== propertyId) {
    return (
      <div className="p-8 max-w-5xl mx-auto mt-12">
        <div className="bg-amber-50 text-amber-700 p-6 rounded-2xl border border-amber-100 font-medium">
          This reservation belongs to another property. Please switch your active property.
        </div>
      </div>
    );
  }

  const guestName = reservation.primaryGuest ? `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName}` : 'Guest profile';
  const room = reservation.reservationRooms?.[0]?.room;
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)] pb-24">
      <div className="relative overflow-hidden bg-[#09152d] px-5 py-8 text-white sm:px-8 lg:px-10">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-[80px]" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="mb-7 flex items-center gap-3"><button onClick={() => router.push('/frontdesk/reservations')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Back to reservations"><ArrowLeft className="h-4 w-4" /></button><span className="text-xs font-semibold text-slate-500">Front Desk</span><span className="text-slate-700">/</span><span className="text-xs font-semibold text-indigo-300">Guest profile</span><span className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Secure folio</span></div>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-400/15 text-lg font-black text-indigo-100"><UserRound className="h-6 w-6" /></div><div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-indigo-300">Reservation cockpit</p><h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">{guestName}</h1><p className="mt-1 text-sm text-slate-400">Confirmation {reservation.confirmationNumber || reservation.id.slice(0, 8).toUpperCase()}</p></div></div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200">{reservation.status?.replace(/_/g, ' ')}</span>{room && <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300"><BedDouble className="h-3.5 w-3.5 text-indigo-300" /> Room {room.number}</span>}</div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px] px-4 pt-8 sm:px-6 lg:px-8">
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
          <FrontDeskReservationDetail reservation={reservation} />
        </div>
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
