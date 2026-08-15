'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { FrontDeskReservationForm } from '@/components/frontdesk/FrontDeskReservationForm';

export default function WalkInPage() {
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Process Walk-In</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              IMMEDIATE
            </span>
          </div>
          <p className="text-slate-500 mt-1 font-medium">Capture guest details and process immediate check-in for tonight.</p>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">
        <FrontDeskReservationForm isWalkIn={true} />
      </div>
    </div>
  );
}
