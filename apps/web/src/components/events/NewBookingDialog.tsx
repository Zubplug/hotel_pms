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

export function NewBookingDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSelect = (type: 'full' | 'hall_only') => {
    setOpen(false);
    router.push(`/fnb/events/bookings/create?type=${type}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" /> New Booking</Button>} />
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Booking Type</DialogTitle>
          <DialogDescription>
            Choose the type of booking you want to create to streamline the setup process.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
