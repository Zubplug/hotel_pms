'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Key, ArrowRight, Wallet, User, LogIn } from 'lucide-react';
import { format } from 'date-fns';
import { HardwareBridge } from '@/lib/desktop/HardwareBridge';
import { useLodgeCoreProvider } from '@/components/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';

interface FrontDeskCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string | null;
  propertyId: string;
}

export function FrontDeskCheckInDialog({ open, onOpenChange, reservationId, propertyId }: FrontDeskCheckInDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [phase, setPhase] = useState<'IDLE' | 'READING' | 'OVERWRITE_CONFIRM' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [existingCardData, setExistingCardData] = useState<any>(null);

  // Fetch full reservation data since the dashboard only passed an ID
  const { data: resData, isLoading: isFetching } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      if (!reservationId) return null;
      const data = await provider.reservations.get(reservationId);
      return data;
    },
    enabled: !!reservationId && open,
  });

  const reservation = resData?.data;

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setPhase('IDLE');
      setOperationId(null);
      setErrorMsg(null);
      setExistingCardData(null);
    }
  }, [open, reservationId]);

  // Polling Effect for Reading
  useEffect(() => {
    if (phase !== 'READING' || !operationId) return;

    const interval = setInterval(async () => {
      try {
        const data = await provider.hardware.poll(operationId);
        const op = data.data.operation;
        const status = op.status;

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          const cardData = op.command?.responseData;
          if (cardData && cardData.checkOut && new Date(cardData.checkOut) > new Date()) {
            setExistingCardData(cardData);
            setPhase('OVERWRITE_CONFIRM');
          } else {
            executeCheckInEncoding();
          }
        } else if (status === 'FAILED' || status === 'ERROR') {
          setPhase('FAILED');
          setErrorMsg(op.errorMessage || 'Hardware agent failed to read the card.');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, operationId]);

  // Polling Effect for Encoding
  useEffect(() => {
    if (phase !== 'ENCODING' || !operationId) return;

    const interval = setInterval(async () => {
      try {
        const data = await provider.hardware.poll(operationId);
        const status = data.data.operation.status;

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          setPhase('SUCCESS');
          queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard', propertyId] });
          queryClient.invalidateQueries({ queryKey: ['reservations'] });
        } else if (status === 'FAILED' || status === 'ERROR') {
          setPhase('FAILED');
          setErrorMsg(data.data.operation.errorMessage || 'Hardware agent failed to encode the card.');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, operationId, queryClient, propertyId]);

  const handleStartCheckIn = async () => {
    try {
      setPhase('READING');
      setErrorMsg(null);

      const data = await provider.keycards.read();

      if (!data || data.error) {
        setPhase('FAILED');
        setErrorMsg(data?.error?.message || 'Failed to initiate read card');
        return;
      }

      setOperationId(data.data.operation.id);
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const executeCheckInEncoding = async () => {
    try {
      setPhase('ENCODING');
      setErrorMsg(null);
      setOperationId(null); 

      const data = await provider.reservations.checkIn(reservationId!, "System", "Device1");

      if (!data || data.error) {
        setPhase('FAILED');
        setErrorMsg(data?.error?.message || 'Failed to initiate check-in');
        return;
      }

      if (data.data?.operation?.id) {
        setOperationId(data.data.operation.id);
      } else {
        // Fallback if no hardware operation was returned (e.g. bypass or software-only checkin)
        setPhase('SUCCESS');
        queryClient.invalidateQueries({ queryKey: ['frontdesk', 'dashboard', propertyId] });
      }
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const room = reservation?.reservationRooms?.[0]?.room;
  const guest = reservation?.primaryGuest;
  const isReady = reservation?.status === 'CONFIRMED' && room;

  return (
    <Dialog open={open && !!reservationId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <LogIn className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Check-In Guest</h2>
              <p className="text-slate-400 text-sm font-medium">Issue keycard and authorize stay</p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 min-h-[300px] flex flex-col justify-center overflow-y-auto flex-1">
          
          {isFetching ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">Fetching reservation details...</p>
            </div>
          ) : !reservation ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-bold">Reservation not found.</p>
              <Button className="mt-4" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          ) : (
            <>
              {phase === 'IDLE' && (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {guest?.firstName} {guest?.lastName}
                        </h3>
                        <p className="text-slate-500 text-sm font-medium">Folio #{reservation.confirmationNumber}</p>
                      </div>
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                        {guest?.firstName?.[0]}{guest?.lastName?.[0]}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-400 uppercase">Room</p>
                        <p className="font-bold text-slate-800">{room?.number ? formatRoomNumber(room.number) : 'Unassigned'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Check-Out</p>
                        <p className="font-bold text-slate-800">
                          {reservation.checkOut ? format(new Date(reservation.checkOut), 'MMM d') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!isReady ? (
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm font-bold border border-amber-200 mb-6 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <p>Guest is not ready for check-in. Please ensure they have a room assigned and outstanding balance is cleared.</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Key className="h-8 w-8 text-blue-600 animate-pulse" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">Place Blank Card</h3>
                      <p className="text-slate-500 mb-6 max-w-[280px] mx-auto text-sm">
                        Place a blank keycard on the encoder, then click below to encode and check-in.
                      </p>
                      <Button onClick={handleStartCheckIn} className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-lg shadow-blue-200">
                        Encode Keycard <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {(phase === 'READING' || phase === 'ENCODING') && (
                <div className="text-center space-y-6 animate-in fade-in duration-300">
                  <div className="relative w-24 h-24 mx-auto">
                    <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                    <div className="relative w-full h-full bg-white rounded-full border-4 border-blue-500 flex items-center justify-center shadow-lg">
                      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {phase === 'READING' && 'Reading Keycard...'}
                      {phase === 'ENCODING' && 'Encoding Keycard...'}
                    </h3>
                    <p className="text-slate-500 mt-2 font-medium">Please do not remove the card</p>
                  </div>
                </div>
              )}

              {phase === 'OVERWRITE_CONFIRM' && (
                <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <AlertCircle className="h-8 w-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Active Card Detected</h3>
                  <div className="bg-amber-50 text-amber-900 p-4 rounded-xl text-sm mb-6 text-left border border-amber-200">
                    <p className="font-bold mb-1">This card is currently active:</p>
                    <ul className="list-disc pl-4 space-y-1 font-medium">
                      <li>Room: {existingCardData?.roomNo}</li>
                      <li>Expires: {format(new Date(existingCardData?.checkOut), 'PPP p')}</li>
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 font-bold" onClick={() => setPhase('IDLE')}>
                      Cancel
                    </Button>
                    <Button variant="default" className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold shadow-sm" onClick={executeCheckInEncoding}>
                      Overwrite Card
                    </Button>
                  </div>
                </div>
              )}

              {phase === 'SUCCESS' && (
                <div className="text-center animate-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Check-In Complete</h3>
                  <p className="text-slate-500 mb-8 max-w-[280px] mx-auto">
                    {guest?.firstName} has been checked in and the keycard is ready.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => router.push(`/frontdesk/reservations/${reservation.id}`)} variant="outline" className="flex-1 h-14 rounded-2xl font-bold border-slate-200">
                      View Folio
                    </Button>
                    <Button onClick={() => onOpenChange(false)} className="flex-1 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 font-bold">
                      Done
                    </Button>
                  </div>
                </div>
              )}

              {phase === 'FAILED' && (
                <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <AlertCircle className="h-10 w-10 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Check-In Failed</h3>
                  <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium mb-8 text-left border border-red-100 break-words">
                    {errorMsg}
                  </div>
                  <Button onClick={() => setPhase('IDLE')} variant="outline" className="w-full h-12 rounded-xl border-slate-200 font-bold mb-3">
                    Try Again
                  </Button>
                  <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full text-slate-500 font-medium">
                    Cancel
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
