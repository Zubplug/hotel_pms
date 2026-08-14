'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2 } from 'lucide-react';

export function EditReservationDialog({ open, onOpenChange, reservation }: { open: boolean; onOpenChange: (open: boolean) => void; reservation: any }) {
  const queryClient = useQueryClient();
  const resRoom = reservation.reservationRooms?.[0];

  const [checkIn, setCheckIn] = useState<Date>(new Date(resRoom?.checkIn));
  const [checkOut, setCheckOut] = useState<Date>(new Date(resRoom?.checkOut));
  const [adults, setAdults] = useState<number>(resRoom?.adults || 1);
  const [children, setChildren] = useState<number>(resRoom?.children || 0);
  const [specialRequests, setSpecialRequests] = useState<string>(reservation.specialRequests || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          adults,
          children,
          specialRequests
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to update reservation');
      
      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        setCheckIn(new Date(resRoom?.checkIn));
        setCheckOut(new Date(resRoom?.checkOut));
        setAdults(resRoom?.adults || 1);
        setChildren(resRoom?.children || 0);
        setSpecialRequests(reservation.specialRequests || '');
        setError(null);
      }
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Reservation Details</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Check-in Date</label>
              <Input 
                type="date" 
                value={checkIn ? format(checkIn, 'yyyy-MM-dd') : ''} 
                onChange={(e) => setCheckIn(new Date(e.target.value))} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Check-out Date</label>
              <Input 
                type="date" 
                value={checkOut ? format(checkOut, 'yyyy-MM-dd') : ''} 
                onChange={(e) => setCheckOut(new Date(e.target.value))} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Adults</label>
              <Input type="number" min="1" value={adults} onChange={(e) => setAdults(parseInt(e.target.value))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Children</label>
              <Input type="number" min="0" value={children} onChange={(e) => setChildren(parseInt(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Special Requests</label>
            <Textarea 
              placeholder="Any special requests or notes" 
              value={specialRequests} 
              onChange={(e) => setSpecialRequests(e.target.value)} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting || !checkIn || !checkOut || checkOut <= checkIn}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
