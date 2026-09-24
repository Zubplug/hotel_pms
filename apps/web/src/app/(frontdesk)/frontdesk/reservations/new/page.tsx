'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, ShieldCheck, Wifi } from 'lucide-react';
import { FrontDeskReservationForm } from '@/components/frontdesk/FrontDeskReservationForm';

export default function NewReservationPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.08),transparent_55%),linear-gradient(180deg,#f0f4fa_0%,#e8eef7_100%)]">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden bg-[#0b1730] px-6 py-8 sm:px-10 sm:py-10">
        {/* ambient glows */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-80px] left-1/4 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1440px]">
          {/* breadcrumb row */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => router.push('/frontdesk')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-slate-500">Front Desk</span>
            <span className="text-slate-700">/</span>
            <span className="text-xs font-semibold text-indigo-300">New Reservation</span>
          </div>

          {/* title block */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-indigo-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
                Front Desk Operations · Reservations
              </div>
              <h1 className="flex items-center gap-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-400/15 text-indigo-200">
                  <CalendarPlus className="h-6 w-6" />
                </span>
                New Reservation
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Create a fully traceable future booking. Every field is logged against today&apos;s business date and remains available offline.
              </p>
            </div>

            {/* trust badges */}
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Auditable trail
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-slate-300">
                <Wifi className="h-3.5 w-3.5 text-indigo-300" /> Offline-ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="mx-auto max-w-[1440px] px-4 py-8 pb-24 sm:px-6 lg:px-8">
        <FrontDeskReservationForm isWalkIn={false} />
      </div>
    </div>
  );
}
