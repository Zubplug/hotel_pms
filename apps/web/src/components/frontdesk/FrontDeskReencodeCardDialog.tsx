'use client';

import React, { useState, useEffect } from 'react';
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
import { Loader2, AlertCircle, CheckCircle2, KeySquare, Search, ArrowRight, User } from 'lucide-react';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';
import { formatRoomNumber } from '@/lib/format-room';
import { Input } from '@/components/ui/input';

interface FrontDeskReencodeCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export function FrontDeskReencodeCardDialog({ open, onOpenChange, propertyId }: FrontDeskReencodeCardDialogProps) {
  const router = useRouter();
  const { provider } = useLodgeCoreProvider();
  
  const [phase, setPhase] = useState<'SELECT' | 'PROMPT_ENCODE' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('SELECT');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  
  const [encodeOperationId, setEncodeOperationId] = useState<string | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch checked-in reservations
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['frontdesk', 'reencode-search', propertyId, searchQuery],
    queryFn: async () => {
      const res = await provider.reservations.list(propertyId, {
        status: 'CHECKED_IN',
        search: searchQuery || undefined,
        limit: 10
      });
      return res?.data?.data || res?.data || [];
    },
    enabled: open && phase === 'SELECT',
  });

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setPhase('SELECT');
      setSearchQuery('');
      setSelectedReservation(null);
      setEncodeOperationId(null);
      setErrorMsg(null);
      setHardwareStatus('');
    }
  }, [open]);

  // Polling Effect for Encoding
  useEffect(() => {
    if (phase !== 'ENCODING' || !encodeOperationId) return;

    const interval = setInterval(async () => {
      try {
        const data = await provider.hardware.poll(encodeOperationId);
        if (!data || data.error) throw new Error('Failed to poll operation status');
        
        const status = data.data.operation.status;
        setHardwareStatus(status);

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          setPhase('SUCCESS');
          router.refresh();
        } else if (status === 'FAILED') {
          setPhase('FAILED');
          setErrorMsg(data.data.operation.errorMessage || 'Hardware agent failed to encode the card.');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, encodeOperationId, router]);

  const handleSelectReservation = (reservation: any) => {
    setSelectedReservation(reservation);
    setPhase('PROMPT_ENCODE');
  };

  const handleStartEncode = async () => {
    try {
      setPhase('ENCODING');
      setHardwareStatus('STARTING');
      setErrorMsg(null);

      const roomId = selectedReservation?.reservationRooms?.[0]?.room?.id || selectedReservation?.reservationRooms?.[0]?.roomId;
      if (!roomId) {
        setPhase('FAILED');
        setErrorMsg('Reservation has no assigned room.');
        return;
      }

      const data = await provider.keycards.encode(roomId, '', selectedReservation.id);

      if (!data || data.error) {
        setPhase('FAILED');
        setErrorMsg(data?.error?.message || 'Failed to initiate encode.');
        return;
      }

      setEncodeOperationId(data.data.operation.id);
      setHardwareStatus(data.data.operation.status);
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const getStatusText = () => {
    switch (hardwareStatus) {
      case 'QUEUED':
        return 'Command sent to queue...';
      case 'DISPATCHING':
        return 'Waiting for Windows Agent to pick up...';
      case 'WAITING_FOR_CARD':
        return 'Please place a blank card on the USB Encoder now.';
      case 'CARD_DETECTED':
        return 'Card detected. Processing...';
      case 'VERIFYING_CARD':
        return 'Verifying encoder...';
      case 'ENCODING':
        return 'Writing room and expiration date to card...';
      default:
        return hardwareStatus || 'Initializing...';
    }
  };

  const roomName = selectedReservation?.reservationRooms?.[0]?.room?.number || 'Unassigned';
  const guestName = `${selectedReservation?.primaryGuest?.firstName || ''} ${selectedReservation?.primaryGuest?.lastName || ''}`.trim();
  const initials = guestName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'G';

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (phase === 'ENCODING' && !val) return;
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 rounded-xl">
                <KeySquare className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Re-Encode Key Card</h2>
                <p className="text-slate-400 text-sm font-medium">Create a new key for an in-house guest</p>
              </div>
            </div>
            {phase !== 'SELECT' && phase !== 'SUCCESS' && (
              <Button variant="ghost" size="sm" onClick={() => setPhase('SELECT')} className="text-slate-300 hover:text-white">
                Change Guest
              </Button>
            )}
          </div>
        </div>

        <div className="bg-slate-50 min-h-[400px] flex flex-col flex-1 overflow-hidden">
          
          {phase === 'SELECT' && (
            <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300 p-6">
              <div className="relative mb-6 shrink-0">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input 
                  placeholder="Search checked-in guests by name or room..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 rounded-xl border-slate-200 bg-white shadow-sm text-base"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-6">
                {isSearching ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                  </div>
                ) : searchResults?.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No checked-in guests found.</p>
                  </div>
                ) : (
                  searchResults?.map((res: any) => (
                    <div 
                      key={res.id} 
                      onClick={() => handleSelectReservation(res)}
                      className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-700 font-bold">
                          {res.primaryGuest?.firstName?.[0] || 'G'}{res.primaryGuest?.lastName?.[0] || ''}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-lg">
                            {res.primaryGuest?.firstName} {res.primaryGuest?.lastName}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                              Room {formatRoomNumber(res.reservationRooms?.[0]?.room?.number)}
                            </span>
                            <span>•</span>
                            <span>Check-out: {res.checkOut ? new Date(res.checkOut).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {phase === 'PROMPT_ENCODE' && (
            <div className="animate-in fade-in zoom-in-95 duration-500 flex flex-col justify-center h-full p-8 text-center">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-8">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-700 mx-auto mb-3">
                  {initials}
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {guestName}
                </h3>
                <p className="text-slate-500 font-medium text-lg mt-1">Room {roomName}</p>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">Place Blank Card on Encoder</h3>
              <p className="text-slate-500 max-w-[300px] mx-auto mb-8">
                Place a new or erased card on the USB hardware encoder to encode it for this guest.
              </p>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-14 rounded-xl border-slate-200 font-bold" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleStartEncode} className="flex-1 h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-lg font-bold shadow-md">
                  Encode Key <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {phase === 'ENCODING' && (
            <div className="text-center space-y-6 animate-in fade-in duration-300 flex flex-col justify-center h-full p-8">
              <div className="relative w-28 h-28 mx-auto">
                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative w-full h-full bg-white rounded-full border-4 border-blue-500 flex items-center justify-center shadow-lg">
                  <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  Encoding Card...
                </h3>
                <p className="text-slate-500 font-medium text-lg">{getStatusText()}</p>
              </div>
            </div>
          )}

          {phase === 'SUCCESS' && (
            <div className="text-center animate-in zoom-in duration-500 flex flex-col justify-center h-full p-8">
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900 mb-3">Key Created!</h3>
              <p className="text-slate-500 mb-8 max-w-[300px] mx-auto text-lg">
                The key card for {guestName} in Room {roomName} is ready to use.
              </p>
              <Button onClick={() => onOpenChange(false)} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-lg font-bold">
                Done
              </Button>
            </div>
          )}

          {phase === 'FAILED' && (
            <div className="text-center animate-in slide-in-from-bottom-4 duration-500 flex flex-col justify-center h-full p-8">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Encoding Failed</h3>
              <div className="bg-red-50 text-red-800 p-4 rounded-xl font-medium mb-8 text-left border border-red-100 break-words">
                {errorMsg}
              </div>
              <div className="flex gap-3">
                <Button onClick={() => onOpenChange(false)} variant="ghost" className="flex-1 h-12 text-slate-500 font-bold">
                  Close
                </Button>
                <Button onClick={handleStartEncode} variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 font-bold">
                  Try Again
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
