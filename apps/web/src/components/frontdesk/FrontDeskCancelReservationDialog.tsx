'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface FrontDeskCancelReservationDialogProps {
  reservation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FrontDeskCancelReservationDialog({ reservation, open, onOpenChange }: FrontDeskCancelReservationDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const { provider } = useLodgeCoreProvider();

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await provider.reservations.cancel(reservation.id, reason);
      if (!res.success) {
        throw new Error(res.error?.message || res.error || 'Failed to cancel reservation');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard'] });
      onOpenChange(false);
      setReason('');
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const resRoom = reservation.reservationRooms?.[0];
  const room = resRoom?.room;
  const guest = reservation.primaryGuest;

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!cancelMutation.isPending) {
        onOpenChange(val);
        if (!val) {
          setError('');
          setReason('');
        }
      }
    }}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4 shrink-0">
          <div className="bg-red-100 p-3 rounded-xl text-red-600 shadow-sm shrink-0 mt-1">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-red-900">Cancel Reservation?</DialogTitle>
            <DialogDescription className="text-red-700/80 mt-1 font-medium">
              This action cannot be undone. The room will be immediately returned to inventory.
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
            <p className="font-bold text-slate-900">{guest?.firstName} {guest?.lastName}</p>
            <p className="text-sm text-slate-500 font-medium">Confirmation #{reservation.confirmationNumber}</p>
            <p className="text-sm text-slate-500">Room {room?.number || 'Unassigned'} • {room?.roomType?.name}</p>
            <p className="text-sm text-slate-500">
              {resRoom?.checkIn ? format(new Date(resRoom.checkIn), 'MMM d, yyyy') : 'N/A'} → {resRoom?.checkOut ? format(new Date(resRoom.checkOut), 'MMM d, yyyy') : 'N/A'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Cancellation Reason <span className="text-red-500">*</span></label>
            <Textarea 
              placeholder="e.g. Guest requested cancellation over phone" 
              className="resize-none h-24 bg-white"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={cancelMutation.isPending}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 shrink-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={cancelMutation.isPending}
            className="rounded-xl font-medium"
          >
            Keep Reservation
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending || reason.trim().length < 3}
            className="rounded-xl font-bold px-6 shadow-sm shadow-red-200"
          >
            {cancelMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelling...</>
            ) : (
              'Cancel Reservation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
