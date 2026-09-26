'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ArrowRight, CalendarDays, CheckCircle2, Layers3, Plus, UtensilsCrossed, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { FullPackageWizard } from './FullPackageWizard';
import { HallOnlyWizard } from './HallOnlyWizard';

type Hall = { id: string; name: string; capacity: number };
type Package = { id: string; name: string; basePrice: unknown; description?: string | null };
type Equipment = { id: string; name: string; totalStock: number; rentalPrice: unknown };

export function NewBookingDialog({
  initialHalls,
  initialPackages,
  equipmentList,
  guests,
  corporateAccounts,
}: {
  initialHalls: Hall[];
  initialPackages: Package[];
  equipmentList: Equipment[];
  guests: any[];
  corporateAccounts: any[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'full' | 'hall_only' | null>(null);
  const router = useRouter();

  const handleSelect = (type: 'full' | 'hall_only') => {
    setSelectedType(type);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setSelectedType(null); }}>
      <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" /> New Booking</Button>} />
      <DialogContent className={cn('max-h-[92vh] overflow-y-auto', selectedType ? 'sm:max-w-[1080px]' : 'sm:max-w-[780px]')}>
        <DialogHeader className="border-b border-[#eadfd8] pb-4">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="text-xl text-[#24130d]">{open && selectedType === 'full' ? 'New banquet event' : open && selectedType === 'hall_only' ? 'New hall booking' : 'Create a new event booking'}</DialogTitle>
              <DialogDescription className="mt-2">
                {selectedType ? 'Complete the event details below. Availability and inventory are checked when you submit.' : 'Choose the commercial flow that matches what the guest is buying.'}
              </DialogDescription>
            </div>
            {selectedType && <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedType(null)}>Change type</Button>}
          </div>
        </DialogHeader>
        {!selectedType ? <div className="py-5">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700"><Layers3 className="h-4 w-4" /> Select a booking path</div>
          <div className="grid gap-4 md:grid-cols-2">
            <button type="button" onClick={() => handleSelect('full')} className="group relative overflow-hidden rounded-2xl border border-[#eadfd8] bg-gradient-to-br from-[#fff8f2] to-white p-5 text-left transition hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-[0_14px_30px_rgba(194,65,12,0.12)]">
              <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-orange-100/60 transition group-hover:bg-orange-200/70" />
              <div className="relative flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#24130d] text-orange-300"><UtensilsCrossed className="h-5 w-5" /></div><span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-800">Recommended</span></div>
              <h3 className="relative mt-5 text-lg font-bold text-[#24130d]">Full banquet event</h3><p className="relative mt-2 text-sm leading-5 text-[#6f5d53]">For weddings, conferences, celebrations, and catered events where the hall and F&B package move together.</p>
              <div className="relative mt-5 space-y-2 text-xs text-[#6f5d53]"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Hall, date and guest profile</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Banquet package and dietary notes</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> BEO-ready operational handoff</div></div>
              <div className="relative mt-6 flex items-center justify-between border-t border-[#eadfd8] pt-4 text-xs font-bold text-orange-700">Start full event setup <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
            </button>
            <button type="button" onClick={() => handleSelect('hall_only')} className="group rounded-2xl border border-[#eadfd8] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-[0_14px_30px_rgba(65,32,19,0.08)]">
              <div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><CalendarDays className="h-5 w-5" /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">Space rental</span></div>
              <h3 className="mt-5 text-lg font-bold text-[#24130d]">Hall only</h3><p className="mt-2 text-sm leading-5 text-[#6f5d53]">For meetings, rehearsals, photoshoots, space rentals, and events where catering is handled separately.</p>
              <div className="mt-5 space-y-2 text-xs text-[#6f5d53]"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Fast space reservation</div><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-600" /> Optional equipment inventory</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Conflict-safe schedule creation</div></div>
              <div className="mt-6 flex items-center justify-between border-t border-[#eadfd8] pt-4 text-xs font-bold text-orange-700">Start hall reservation <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
            </button>
          </div>
          <p className="mt-5 text-center text-xs text-[#947d72]">Both paths verify hall capacity, schedule conflicts, buffers, recurrence, and inventory before saving.</p>
        </div> : selectedType === 'full' ? <FullPackageWizard initialHalls={initialHalls} equipmentList={equipmentList} packageList={initialPackages} guests={guests} corporateAccounts={corporateAccounts} onCreated={() => { setOpen(false); router.refresh(); }} /> : <HallOnlyWizard initialHalls={initialHalls} equipmentList={equipmentList} guests={guests} corporateAccounts={corporateAccounts} onCreated={() => { setOpen(false); router.refresh(); }} />}
      </DialogContent>
    </Dialog>
  );
}
