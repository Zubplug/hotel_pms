'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, CheckCircle2, Key, ArrowRight, KeySquare } from 'lucide-react';
import { format } from 'date-fns';

interface FrontDeskExtendKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservation: any;
}

export function FrontDeskExtendKeyDialog({ open, onOpenChange, reservation }: FrontDeskExtendKeyDialogProps) {
  const router = useRouter();
  
  const [phase, setPhase] = useState<'IDLE' | 'READING' | 'ENCODING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [readOperationId, setReadOperationId] = useState<string | null>(null);
  const [encodeOperationId, setEncodeOperationId] = useState<string | null>(null);
  const [hardwareStatus, setHardwareStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setPhase('IDLE');
      setReadOperationId(null);
      setEncodeOperationId(null);
      setErrorMsg(null);
      setHardwareStatus('');
    }
  }, [open]);

  // Polling Effect for Reading
  useEffect(() => {
    if (phase !== 'READING' || !readOperationId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/hardware/operations/${readOperationId}`);
        if (!res.ok) throw new Error('Failed to poll operation status');
        
        const data = await res.json();
        const op = data.data.operation;
        const status = op.status;
        
        setHardwareStatus(status);

        if (status === 'SUCCESS' || status === 'COMPLETED') {
          // Card read successfully. Proceed to Encode.
          executeEncodeCard(readOperationId);
        } else if (status === 'FAILED') {
          setPhase('FAILED');
          setErrorMsg(op.errorMessage || 'Hardware agent failed to read the card.');
        }
      } catch (err) {
        console.error(err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, readOperationId]);

  // Polling Effect for Encoding
  useEffect(() => {
    if (phase !== 'ENCODING' || !encodeOperationId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/hardware/operations/${encodeOperationId}`);
        if (!res.ok) throw new Error('Failed to poll operation status');
        
        const data = await res.json();
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

  const handleStartExtension = async () => {
    try {
      setPhase('READING');
      setHardwareStatus('STARTING');
      setErrorMsg(null);

      const res = await fetch('/api/v1/hardware/locks/read-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: reservation.propertyId }),
      });
      
      const data = await res.json();

      if (!res.ok) {
        setPhase('FAILED');
        setErrorMsg(data.error?.message || 'Failed to initiate read card');
        return;
      }

      setReadOperationId(data.data.operation.id);
      setHardwareStatus(data.data.operation.status);
    } catch (err: unknown) {
      setPhase('FAILED');
      setErrorMsg(err instanceof Error ? err.message : 'Network error occurred');
    }
  };

  const executeEncodeCard = async (readOpId: string) => {
    try {
      setPhase('ENCODING');
      setHardwareStatus('VERIFYING_CARD');
      setErrorMsg(null);

      const res = await fetch(`/api/v1/hardware/locks/extend-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          propertyId: reservation.propertyId,
          reservationId: reservation.id,
          readOperationId: readOpId
        }),
      });
      
      const data = await res.json();

      if (!res.ok) {
        setPhase('FAILED');
        setErrorMsg(data.error?.message || 'Failed to initiate encode. Card mismatch?');
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
        return 'Please place the guest\'s current card on the USB Encoder now.';
      case 'CARD_DETECTED':
        return 'Card detected. Processing...';
      case 'VERIFYING_CARD':
        return 'Verifying card belongs to correct room...';
      case 'ENCODING':
        return 'Writing new expiration date to card...';
      default:
        return hardwareStatus || 'Initializing...';
    }
  };

  const roomName = reservation?.reservationRooms?.[0]?.room?.number || 'Unassigned';

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Prevent closing by clicking outside while encoding or reading
      if ((phase === 'ENCODING' || phase === 'READING') && !val) return;
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-0 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 px-8 py-6 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-xl">
              <KeySquare className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Extend Key Card</h2>
              <p className="text-slate-400 text-sm font-medium">Update the physical access card expiration</p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 min-h-[300px] flex flex-col justify-center overflow-y-auto flex-1">
          
          {phase === 'IDLE' && (
            <div className="animate-in fade-in zoom-in-95 duration-500 w-full max-w-sm mx-auto">
              
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6 text-center">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-xl font-bold text-slate-600 mx-auto mb-3">
                  {reservation?.primaryGuest?.firstName?.[0]}{reservation?.primaryGuest?.lastName?.[0]}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {reservation?.primaryGuest?.firstName} {reservation?.primaryGuest?.lastName}
                </h3>
                <p className="text-slate-500 font-medium">Room {roomName}</p>
              </div>

              <div className="text-center mb-8">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Place Card on Encoder</h3>
                <p className="text-slate-500 max-w-[280px] mx-auto text-sm">
                  Place the current physical room key on the USB hardware encoder to verify and update it.
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 font-bold" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleStartExtension} className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-base font-bold shadow-md">
                  Update Key <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
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
                  {phase === 'READING' ? 'Reading Card...' : 'Updating Card...'}
                </h3>
                <p className="text-slate-500 mt-2 font-medium">{getStatusText()}</p>
              </div>
            </div>
          )}

          {phase === 'SUCCESS' && (
            <div className="text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Card Updated Successfully</h3>
              <p className="text-slate-500 mb-8 max-w-[280px] mx-auto">
                The physical key card has been updated with the new check-out date and is ready to use.
              </p>
              <Button onClick={() => onOpenChange(false)} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-lg font-bold">
                Done
              </Button>
            </div>
          )}

          {phase === 'FAILED' && (
            <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Hardware Error</h3>
              <div className="bg-red-50 text-red-800 p-4 rounded-xl text-sm font-medium mb-8 text-left border border-red-100 break-words">
                {errorMsg}
              </div>
              <div className="flex gap-3">
                <Button onClick={() => onOpenChange(false)} variant="ghost" className="flex-1 h-12 text-slate-500 font-bold">
                  Cancel
                </Button>
                <Button onClick={handleStartExtension} variant="outline" className="flex-1 h-12 rounded-xl border-slate-200 font-bold">
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
