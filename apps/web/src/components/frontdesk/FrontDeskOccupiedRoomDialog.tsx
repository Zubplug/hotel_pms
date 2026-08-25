'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Key, CalendarClock, CreditCard, User, ExternalLink, RefreshCw, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { formatRoomNumber } from '@/lib/format-room';
import { useProperty } from '@/components/PropertyProvider';
import { FrontDeskExtendStayDialog } from './FrontDeskExtendStayDialog';
import { FrontDeskQuickCheckoutDialog } from './FrontDeskQuickCheckoutDialog';

interface FrontDeskOccupiedRoomDialogProps {
  room: { id: string; number: string; status: string } | null;
  isOpen: boolean;
  onClose: () => void;
}

import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

export function FrontDeskOccupiedRoomDialog({ room, isOpen, onClose }: FrontDeskOccupiedRoomDialogProps) {
  const router = useRouter();
  const { propertyId } = useProperty();
  const { provider } = useLodgeCoreProvider();
  
  const [showExtendStay, setShowExtendStay] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);

  const { data: resData, isLoading, isError, refetch } = useQuery({
    queryKey: ['active-reservation', room?.id],
    queryFn: async () => {
      const res = await provider.rooms.getActiveReservation(room!.id);
      if (res?.error) throw new Error(res.error.message || res.error || 'Failed to fetch active reservation');
      return res.data;
    },
    enabled: !!room?.id && isOpen && room.status === 'OCCUPIED',
  });

  if (!room || room.status !== 'OCCUPIED') return null;

  const handleViewReservation = (reservationId: string) => {
    onClose();
    router.push(`/frontdesk/reservations/detail?id=${reservationId}`);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2rem] border-0 shadow-2xl flex flex-col max-h-[90vh]">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shrink-0">
            <DialogHeader>
              <div className="flex justify-between items-center mb-1">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white">
                  Room {formatRoomNumber(room.number)}
                </DialogTitle>
                <div className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold tracking-wider">
                  OCCUPIED
                </div>
              </div>
              <DialogDescription className="text-slate-400">
                Guest commands and information
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 bg-slate-50 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium text-sm">Loading guest data...</p>
              </div>
            ) : isError || !resData ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Occupancy record unavailable</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-[260px] mx-auto">
                  The room is marked occupied but no active reservation was found.
                </p>
                <Button 
                  onClick={() => refetch()} 
                  variant="outline" 
                  className="rounded-xl border-slate-300 font-semibold"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reconcile / Refresh
                </Button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Guest Info */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-700">
                      {resData.guest.firstName[0]}{resData.guest.lastName[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">
                        {resData.guest.firstName} {resData.guest.lastName}
                        {resData.guest.isVip && <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">VIP</span>}
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">
                        {resData.guest.email || resData.guest.phone || 'No contact info'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stay Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-in</p>
                    <p className="font-bold text-slate-900">{format(new Date(resData.checkIn), 'MMM do, yyyy')}</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Check-out</p>
                    <p className="font-bold text-slate-900">{format(new Date(resData.checkOut), 'MMM do, yyyy')}</p>
                  </div>
                </div>

                {/* Folio Balance */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <CreditCard className="w-5 h-5 text-slate-600" />
                    </div>
                    <span className="font-semibold text-slate-700">Folio Balance</span>
                  </div>
                  <span className={`font-black text-lg ${resData.folioBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: resData.currency || 'NGN', maximumFractionDigits: 0 }).format(resData.folioBalance)}
                  </span>
                </div>

                {/* Active Key */}
                {resData.lockCredentials && resData.lockCredentials.length > 0 && (
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <Key className="w-4 h-4" />
                    <span>Active Keycard Encoded</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      className="rounded-xl h-12 bg-blue-600 hover:bg-blue-700 font-bold shadow-sm"
                      onClick={() => setShowExtendStay(true)}
                    >
                      <CalendarClock className="w-4 h-4 mr-2" /> Extend Stay
                    </Button>
                    <Button 
                      className="rounded-xl h-12 bg-slate-900 hover:bg-slate-800 font-bold shadow-sm"
                      onClick={() => setShowCheckOut(true)}
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Checkout
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {resData && (
            <div className="bg-white p-4 border-t border-slate-100 shrink-0">
              <Button 
                variant="ghost" 
                className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold"
                onClick={() => handleViewReservation(resData.reservationId)}
              >
                View Full Reservation <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sub Dialogs */}
      {resData && (
        <>
          <FrontDeskExtendStayDialog 
            open={showExtendStay} 
            onOpenChange={setShowExtendStay} 
            reservation={{
              id: resData.reservationId,
              checkOut: resData.checkOut,
              reservationRooms: [{ room: { number: resData.room.number } }]
            }}
          />
          <FrontDeskQuickCheckoutDialog
            open={showCheckOut}
            onOpenChange={(open) => {
              setShowCheckOut(open);
              if (!open) onClose(); // close parent if checkout is done or cancelled
            }}
            propertyId={propertyId}
            initialReservation={{
              id: resData.reservationId,
              primaryGuest: resData.guest,
              reservationRooms: [{ room: { number: resData.room.number } }],
              folios: [{ balance: resData.folioBalance, currency: resData.currency }]
            }}
          />
        </>
      )}
    </>
  );
}
