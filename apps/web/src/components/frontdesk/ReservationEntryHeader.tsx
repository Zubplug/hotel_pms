'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, Check, Clock3, ShieldCheck, Sparkles, UserRound, Wifi } from 'lucide-react';
import { goBack } from '@/lib/frontdesk-navigation';

interface ReservationEntryHeaderProps {
  isWalkIn: boolean;
  isReturningGuest?: boolean;
}

export function ReservationEntryHeader({ isWalkIn, isReturningGuest = false }: ReservationEntryHeaderProps) {
  const router = useRouter();
  const title = isWalkIn
    ? (isReturningGuest ? 'New stay for a returning guest' : 'Welcome a walk-in guest')
    : 'Create a new reservation';
  const description = isWalkIn
    ? 'Move from guest details to a ready room in one smooth desk-side flow.'
    : 'Build a polished, fully traceable stay with live availability and pricing confidence.';

  return (
    <header className="relative overflow-hidden bg-[#09152d] px-5 py-7 text-white sm:px-8 sm:py-9 lg:px-10">
      <div className="pointer-events-none absolute -right-24 -top-36 h-[440px] w-[440px] rounded-full bg-indigo-500/20 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-[-150px] left-[34%] h-[300px] w-[300px] rounded-full bg-cyan-400/10 blur-[90px]" />
      <div className="relative mx-auto max-w-[1440px]">
        <div className="mb-7 flex items-center gap-3">
          <button
            onClick={() => goBack(router, '/frontdesk/reservations')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Back to front desk"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold text-slate-500">Front Desk</span>
          <span className="text-slate-700">/</span>
          <span className="text-xs font-semibold text-indigo-300">{isWalkIn ? 'Walk-In' : 'New Reservation'}</span>
          <span className="ml-auto hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300 sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live workspace
          </span>
        </div>

        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-300/20 bg-indigo-400/15">
                {isWalkIn ? <Clock3 className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
              </span>
              {isWalkIn ? 'Immediate arrival desk' : 'Reservations command center'}
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl lg:text-[42px]">{title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">{description}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <HeaderBadge icon={<UserRound className="h-3.5 w-3.5" />} label={isReturningGuest ? 'Profile linked' : 'Guest first'} />
            <HeaderBadge icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Auditable" />
            <HeaderBadge icon={<Wifi className="h-3.5 w-3.5" />} label="Offline-ready" />
          </div>
        </div>

        <div className="mt-8 grid max-w-3xl grid-cols-3 gap-2 sm:gap-3">
          <ProgressStep label="Guest" active />
          <ProgressStep label="Stay & room" active />
          <ProgressStep label={isWalkIn ? 'Check-in ready' : 'Confirm booking'} />
        </div>
      </div>
    </header>
  );
}

function HeaderBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] font-semibold text-slate-300 sm:px-3">
      <span className="text-indigo-300">{icon}</span>{label}
    </span>
  );
}

function ProgressStep({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${active ? 'border-indigo-300/20 bg-indigo-400/10 text-indigo-100' : 'border-white/10 bg-white/[0.03] text-slate-500'}`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? 'bg-indigo-400 text-[#09152d]' : 'border border-white/15 text-slate-600'}`}>
        {active ? <Check className="h-3 w-3" /> : <Sparkles className="h-2.5 w-2.5" />}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
