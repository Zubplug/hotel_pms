'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { Button } from '@/components/ui/button';
import { FrontDeskAddPaymentDialog } from './FrontDeskAddPaymentDialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCw, MapPin, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface FrontDeskReassignRoomDialogProps {
  reservation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FrontDeskReassignRoomDialog({ reservation, open, onOpenChange }: FrontDeskReassignRoomDialogProps) {
  const queryClient = useQueryClient();
  const resRoom = reservation.reservationRooms?.[0];
  const currentRoom = resRoom?.room;
  const currentRate = Number(currentRoom?.roomType?.baseRate || resRoom?.rateAmount || 0);
  const nights = resRoom?.checkIn && resRoom?.checkOut
    ? Math.max(0, Math.ceil((new Date(resRoom.checkOut).getTime() - (reservation.status === 'CHECKED_IN'
      ? Math.max(new Date(resRoom.checkIn).setHours(0, 0, 0, 0), new Date().setHours(0, 0, 0, 0) + 86400000)
      : new Date(resRoom.checkIn).getTime())) / 86400000))
    : 0;
  const folio = reservation.folio || reservation.folios?.[0];
  const availableFolioCredit = Math.max(0, -Number(folio?.balance || 0));
  
  const checkIn = resRoom?.checkIn ? new Date(resRoom.checkIn).toISOString().split('T')[0] : '';
  const checkOut = resRoom?.checkOut ? new Date(resRoom.checkOut).toISOString().split('T')[0] : '';

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [upgradePayment, setUpgradePayment] = useState<{ folio: any; amount: number; roomId: string } | null>(null);

  const { provider } = useLodgeCoreProvider();

  const { data: availableRooms, isLoading: isLoadingRooms } = useQuery({
    queryKey: ['available-rooms', reservation.propertyId, checkIn, checkOut],
    queryFn: async () => {
      const res = await provider.rooms.getAvailable(reservation.propertyId, '', checkIn, checkOut);
      if (!res.success) throw new Error(res.error?.message || res.error || 'Failed to fetch rooms');
      return res.data;
    },
    enabled: open && !!checkIn && !!checkOut,
  });

  const selectedRoomPreview = availableRooms?.find((r: any) => r.id === selectedRoomId);
  const selectedRate = Number(selectedRoomPreview?.roomType?.baseRate || 0);
  const upgradeAmount = Math.max(0, selectedRate - currentRate) * nights;
  const downgradeCredit = Math.max(0, currentRate - selectedRate) * nights;

  const reassignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoomId) throw new Error('No room selected');
      const selectedRoom = availableRooms?.find((r: any) => r.id === selectedRoomId);
      if (!selectedRoom) throw new Error('Invalid room selected');
      const newRate = Number(selectedRoom.roomType?.baseRate || 0);
      const upgradeAmount = Math.max(0, newRate - currentRate) * nights;
      if (upgradeAmount > 0 && !window.confirm(`This room upgrade adds ${selectedRoom.roomType?.currency || 'NGN'} ${upgradeAmount.toLocaleString()} to the folio. Continue?`)) {
        throw new Error('Room upgrade cancelled');
      }
      if (upgradeAmount > 0 && !(reservation.folio?.id || reservation.folios?.[0]?.id)) {
        throw new Error('Cannot process a room upgrade without an open folio.');
      }

      const res = await provider.reservations.reassignRoom(reservation.id, { 
        roomId: selectedRoom.id,
        roomTypeId: selectedRoom.roomTypeId,
        upgradeAmount,
        downgradeCredit,
        upgradeRate: newRate,
        nights
      });
      if (!res.success) throw new Error(res.error?.message || res.error || 'Failed to reassign room');
      const paymentDue = Math.max(0, upgradeAmount - availableFolioCredit);
      return { data: res.data, upgradeAmount, paymentDue, downgradeCredit, roomId: selectedRoom.id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard'] });
      onOpenChange(false);
      if (result.upgradeAmount > 0 && result.paymentDue > 0) {
        if (!folio?.id) {
          toast.error('Room changed, but the upgrade cannot be collected because no folio is available.');
          return;
        }
        setUpgradePayment({
          folio: {
            ...folio,
            balance: Number(folio.balance || 0) + result.upgradeAmount,
            totalCharges: Number(folio.totalCharges || 0) + result.upgradeAmount,
          },
          amount: result.paymentDue,
          roomId: result.roomId,
        });
      } else if (reservation.status === 'CHECKED_IN') {
        void encodeNewRoomCard(result.roomId);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const encodeNewRoomCard = async (roomId: string) => {
    const encodeResult = await provider.keycards.encode(roomId, '', reservation.id);
    if (!encodeResult?.success || encodeResult?.error) {
      toast.error(encodeResult?.error?.message || encodeResult?.error || 'Room changed, but new room card encoding failed. Use Retry Card.');
    } else {
      toast.success('Payment received and new room card encoding started.');
    }
    queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
  };

  const handleOpenChange = (val: boolean) => {
    if (!reassignMutation.isPending) {
      onOpenChange(val);
      if (!val) {
        setError('');
        setSelectedRoomId(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4 shrink-0">
          <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600 shadow-sm shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold text-slate-900">Reassign Room</DialogTitle>
            <p className="text-sm text-slate-500 font-medium">Select a new room for this reservation</p>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Room</p>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <MapPin className="w-5 h-5 text-slate-400" />
              <span className="text-lg font-bold text-slate-900">Room {currentRoom?.number || 'Unassigned'}</span>
              <span className="text-sm text-slate-500 font-medium ml-1">· {currentRoom?.roomType?.name || 'Unknown'}</span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
              <span>Available Rooms</span>
              <span>{checkIn} to {checkOut}</span>
            </p>
            
            <div className="h-64 overflow-y-auto border border-slate-100 rounded-xl bg-white shadow-inner divide-y divide-slate-50 p-1">
              {isLoadingRooms ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">Finding available rooms...</span>
                </div>
              ) : availableRooms?.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm font-medium">
                  No rooms available for these dates
                </div>
              ) : (
                availableRooms?.map((r: any) => {
                  const isSelected = selectedRoomId === r.id;
                  const isCurrent = r.id === currentRoom?.id;
                  return (
                    <button
                      key={r.id}
                      disabled={isCurrent}
                      onClick={() => setSelectedRoomId(r.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all ${
                        isCurrent 
                          ? 'opacity-50 cursor-not-allowed bg-slate-50' 
                          : isSelected 
                            ? 'bg-emerald-50 border border-emerald-200' 
                            : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className={`font-bold ${isSelected ? 'text-emerald-900' : 'text-slate-900'}`}>Room {r.number}</p>
                          <p className={`text-xs font-medium ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>{r.roomType?.name}</p>
                        </div>
                      </div>
                      <div className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md uppercase">
                        {isCurrent ? 'Current' : 'Available'}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selectedRoomPreview && upgradeAmount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-amber-900">Upgrade charge</span>
                <span className="font-bold text-amber-900">
                  {selectedRoomPreview.roomType?.currency || 'NGN'} {upgradeAmount.toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-amber-800">
                {selectedRoomPreview.roomType?.name} · {nights} remaining night{nights === 1 ? '' : 's'}
              </p>
              {availableFolioCredit > 0 && (
                <p className="mt-1 text-amber-800">Existing folio credit will be applied before payment.</p>
              )}
            </div>
          )}

          {selectedRoomPreview && downgradeCredit > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-blue-900">Downgrade credit</span>
                <span className="font-bold text-blue-900">
                  {selectedRoomPreview.roomType?.currency || 'NGN'} {downgradeCredit.toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-blue-800">This credit will be applied to the guest folio.</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="bg-slate-50 p-4 border-t border-slate-100 shrink-0">
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
            disabled={reassignMutation.isPending}
            className="rounded-xl font-medium"
          >
            Cancel
          </Button>
          <Button 
            onClick={() => reassignMutation.mutate()}
            disabled={reassignMutation.isPending || !selectedRoomId}
            className="rounded-xl font-bold px-6 shadow-sm shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {reassignMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Assigning...</>
            ) : (
              'Reassign Room'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      {upgradePayment && (
        <FrontDeskAddPaymentDialog
          open
          folio={upgradePayment.folio}
          initialAmount={upgradePayment.amount}
          onOpenChange={(open) => { if (!open) setUpgradePayment(null); }}
          onPaymentSuccess={() => {
            if (reservation.status === 'CHECKED_IN') void encodeNewRoomCard(upgradePayment.roomId);
          }}
        />
      )}
  );
}
