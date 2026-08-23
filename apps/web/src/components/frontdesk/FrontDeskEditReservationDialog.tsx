'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Edit3, Loader2 } from 'lucide-react';

interface FrontDeskEditReservationDialogProps {
  reservation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FrontDeskEditReservationDialog({ reservation, open, onOpenChange }: FrontDeskEditReservationDialogProps) {
  const queryClient = useQueryClient();
  
  const resRoom = reservation.reservationRooms?.[0];
  const [checkIn, setCheckIn] = useState(resRoom?.checkIn ? new Date(resRoom.checkIn).toISOString().split('T')[0] : '');
  const [checkOut, setCheckOut] = useState(resRoom?.checkOut ? new Date(resRoom.checkOut).toISOString().split('T')[0] : '');
  const [adults, setAdults] = useState(reservation.adults?.toString() || '1');
  const [children, setChildren] = useState(reservation.children?.toString() || '0');
  const [specialRequests, setSpecialRequests] = useState(reservation.specialRequests || '');
  const [error, setError] = useState('');

  const { provider } = useLodgeCoreProvider();

  const editMutation = useMutation({
    mutationFn: async () => {
      const payload = { 
        checkIn: new Date(checkIn).toISOString(),
        checkOut: new Date(checkOut).toISOString(),
        adults: parseInt(adults),
        children: parseInt(children),
        specialRequests
      };
      
      const res = await provider.reservations.update(reservation.id, payload);
      if (!res.success) {
        throw new Error(res.error?.message || res.error || 'Failed to update reservation');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const resetForm = () => {
    setCheckIn(resRoom?.checkIn ? new Date(resRoom.checkIn).toISOString().split('T')[0] : '');
    setCheckOut(resRoom?.checkOut ? new Date(resRoom.checkOut).toISOString().split('T')[0] : '');
    setAdults(reservation.adults?.toString() || '1');
    setChildren(reservation.children?.toString() || '0');
    setSpecialRequests(reservation.specialRequests || '');
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!editMutation.isPending) {
        onOpenChange(val);
        if (val) resetForm();
      }
    }}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-y-auto max-h-[90vh] border-0 shadow-2xl rounded-2xl">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-xl text-blue-600 shadow-sm shrink-0">
            <Edit3 className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-slate-900">Edit Details</DialogTitle>
            <p className="text-sm text-slate-500 font-medium">Update reservation details for {reservation.primaryGuest?.firstName}</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Check-In</label>
              <Input 
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                disabled={editMutation.isPending}
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Check-Out</label>
              <Input 
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                disabled={editMutation.isPending}
                className="bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Adults</label>
              <Input 
                type="number"
                min="1"
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
                disabled={editMutation.isPending}
                className="bg-slate-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Children</label>
              <Input 
                type="number"
                min="0"
                value={children}
                onChange={(e) => setChildren(e.target.value)}
                disabled={editMutation.isPending}
                className="bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Special Requests</label>
            <Textarea 
              placeholder="Any special requests or notes" 
              className="resize-none h-24 bg-slate-50"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              disabled={editMutation.isPending}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={editMutation.isPending}
            className="rounded-xl font-medium"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => editMutation.mutate()}
            disabled={editMutation.isPending || !checkIn || !checkOut}
            className="rounded-xl font-bold px-6 shadow-sm shadow-blue-200"
          >
            {editMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
