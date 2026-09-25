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
import { Box, CalendarDays, Plus } from 'lucide-react';
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
}: {
  initialHalls: Hall[];
  initialPackages: Package[];
  equipmentList: Equipment[];
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1080px]">
        <DialogHeader>
          <DialogTitle>{open && selectedType === 'full' ? 'New banquet event' : open && selectedType === 'hall_only' ? 'New hall booking' : 'Create a booking'}</DialogTitle>
          <DialogDescription>
            {selectedType ? 'Complete the event details below. Availability and inventory are checked when you submit.' : 'Start with the booking type that matches the service you are selling.'}
          </DialogDescription>
        </DialogHeader>
        {!selectedType ? <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
          <button
            onClick={() => handleSelect('full')}
            className={cn(
              "flex flex-col items-center justify-center p-6 text-center border-2 rounded-xl transition-all",
              "hover:border-primary hover:bg-primary/5 bg-card text-card-foreground shadow-sm"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Box className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Full Event Package</h3>
            <p className="text-sm text-muted-foreground">
              Includes hall reservation, banquet packages, equipment rentals, and detailed run-sheets.
            </p>
          </button>

          <button
            onClick={() => handleSelect('hall_only')}
            className={cn(
              "flex flex-col items-center justify-center p-6 text-center border-2 rounded-xl transition-all",
              "hover:border-primary hover:bg-primary/5 bg-card text-card-foreground shadow-sm"
            )}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CalendarDays className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Hall Only</h3>
            <p className="text-sm text-muted-foreground">
              Simple space reservation without food, beverage, or complex setups.
            </p>
          </button>
        </div> : selectedType === 'full' ? <FullPackageWizard initialHalls={initialHalls} initialPackages={initialPackages} onCreated={() => { setOpen(false); router.refresh(); }} /> : <HallOnlyWizard initialHalls={initialHalls} equipmentList={equipmentList} onCreated={() => { setOpen(false); router.refresh(); }} />}
      </DialogContent>
    </Dialog>
  );
}
