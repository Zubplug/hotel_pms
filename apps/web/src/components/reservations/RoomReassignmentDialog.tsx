'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { formatRoomNumber } from '@/lib/format-room';
import { toast } from 'sonner';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function RoomReassignmentDialog({ open, onOpenChange, reservation }: { open: boolean; onOpenChange: (open: boolean) => void; reservation: any }) {
  const { propertyId } = useProperty();
  const queryClient = useQueryClient();
  
  const resRoom = reservation.reservationRooms?.[0];
  const currentRoomId = resRoom?.roomId;
  const currentRoomTypeId = resRoom?.roomTypeId;
  const checkIn = resRoom?.checkIn;
  const checkOut = resRoom?.checkOut;

  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>(currentRoomTypeId);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { provider } = useLodgeCoreProvider();

  // Fetch Room Types
  const { data: roomTypes } = useQuery({
    queryKey: ['room-types', propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/room-types?propertyId=${propertyId}&pageSize=100`);
      const data = await res.json();
      return (data.data || []).filter((room: any) => room.status === 'AVAILABLE');
    },
    enabled: !!propertyId && open,
  });

  // Fetch Available Rooms
  const { data: availableRooms, isLoading: isLoadingRooms } = useQuery({
    queryKey: ['available-rooms', propertyId, selectedRoomTypeId, checkIn, checkOut],
    queryFn: async () => {
      if (!selectedRoomTypeId || !checkIn || !checkOut) return [];
      const res = await fetch(
        `/api/v1/rooms/available?propertyId=${propertyId}&roomTypeId=${selectedRoomTypeId}&checkIn=${checkIn}&checkOut=${checkOut}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.data;
    },
    enabled: !!propertyId && !!selectedRoomTypeId && open,
  });

  const handleReassign = async () => {
    if (!selectedRoomId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomId: selectedRoomId, 
          roomTypeId: selectedRoomTypeId 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to reassign room');

      if (reservation.status === 'CHECKED_IN') {
        const encodeResult = await provider.keycards.encode(selectedRoomId, '', reservation.id);
        if (!encodeResult?.success || encodeResult?.error) {
          toast.error(encodeResult?.error?.message || encodeResult?.error || 'Room reassigned, but card encoding failed. Use Retry Card.');
        } else {
          toast.success('Room reassigned and new room card encoding started.');
        }
      } else {
        toast.success('Room reassigned successfully. Encode the room card during check-in.');
      }
      
      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
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
        setSelectedRoomTypeId(currentRoomTypeId);
        setSelectedRoomId('');
        setError(null);
      }
      onOpenChange(val);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Room</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Room Type</label>
            <Select value={selectedRoomTypeId} onValueChange={(val) => {
              setSelectedRoomTypeId(val || '');
              setSelectedRoomId('');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select room type">
                  {roomTypes?.find((roomType: any) => roomType.id === selectedRoomTypeId)?.name || 'Select room type'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roomTypes?.map((rt: any) => (
                  <SelectItem key={rt.id} value={rt.id}>
                    {rt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoomTypeId && selectedRoomTypeId !== currentRoomTypeId && roomTypes?.find((rt: any) => rt.id === selectedRoomTypeId) && (
              <div className="bg-amber-50 text-amber-800 p-3 mt-2 rounded-md text-sm border border-amber-200">
                <strong>Notice:</strong> Changing room types will automatically recalculate the nightly rate to the base rate of <strong>{roomTypes.find((rt: any) => rt.id === selectedRoomTypeId).name}</strong>.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Available Rooms</label>
            <Select value={selectedRoomId} onValueChange={(val) => setSelectedRoomId(val || '')} disabled={isLoadingRooms || !availableRooms?.length}>
              <SelectTrigger>
                <SelectValue placeholder={
                  isLoadingRooms ? 'Loading rooms...' : 
                  availableRooms?.length ? 'Select a room' : 
                  'No rooms available'
                }>
                  {(() => {
                    const room = availableRooms?.find((item: any) => item.id === selectedRoomId);
                    return room ? `Room ${formatRoomNumber(room.number)}` : selectedRoomId ? 'Selected room' : undefined;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableRooms?.map((room: any) => (
                  <SelectItem key={room.id} value={room.id}>
                    Room {formatRoomNumber(room.number)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleReassign} disabled={!selectedRoomId || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Reassignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
