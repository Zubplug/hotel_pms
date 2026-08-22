'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowRight, Loader2, Key, AlertTriangle, ShieldCheck, Sparkles, Wind } from 'lucide-react';
import { toast } from 'sonner';
import { getAllowedTransitions, RoomStatus } from '@/lib/room-state-machine';
import { formatRoomNumber } from '@/lib/format-room';

interface FrontDeskRoomStatusDialogProps {
  room: { id: string; number: string; status: string; roomType: { name: string } } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function FrontDeskRoomStatusDialog({
  room,
  isOpen,
  onClose,
  onSuccess,
}: FrontDeskRoomStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!room) return null;

  const currentStatus = room.status as RoomStatus;
  const allowedTransitions = getAllowedTransitions(currentStatus);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return <Key className="w-5 h-5 text-emerald-500" />;
      case 'OCCUPIED': return <Key className="w-5 h-5 text-blue-500" />;
      case 'OUT_OF_ORDER': return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'MAINTENANCE': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'CLEAN': return <Sparkles className="w-5 h-5 text-emerald-500" />;
      case 'DIRTY': return <Wind className="w-5 h-5 text-red-500" />;
      case 'INSPECTED': return <ShieldCheck className="w-5 h-5 text-blue-500" />;
      default: return <Key className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
      case 'OCCUPIED': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
      case 'OUT_OF_ORDER': return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
      case 'MAINTENANCE': return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200';
      case 'CLEAN': return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200';
      case 'DIRTY': return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200';
    }
  };

  async function handleConfirm() {
    if (!selectedStatus) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/rooms/${room!.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: selectedStatus, source: 'MANUAL' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Failed to update status');
      }
      toast.success(`Room ${formatRoomNumber(room!.number)} status updated to ${selectedStatus}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
      setSelectedStatus(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setSelectedStatus(null);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-[2rem] border-0 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2 text-white">
              <Key className="w-6 h-6 text-blue-400" /> Room {formatRoomNumber(room.number)}
            </DialogTitle>
            <DialogDescription className="text-slate-300">
              {room.roomType?.name ?? "Unknown Room Type"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6 flex items-center justify-between bg-slate-950/30 p-4 rounded-2xl border border-white/10">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Current Status</span>
              <span className="font-extrabold text-lg flex items-center gap-2">
                {getStatusIcon(currentStatus)} {currentStatus}
              </span>
            </div>
            {selectedStatus && (
              <>
                <ArrowRight className="w-5 h-5 text-slate-500 animate-pulse" />
                <div className="flex flex-col text-right">
                  <span className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-1">New Status</span>
                  <span className="font-extrabold text-lg text-white">
                    {selectedStatus}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 overflow-y-auto flex-1">
          <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Select New Status</h4>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            {allowedTransitions.length === 0 ? (
              <p className="col-span-2 text-sm text-slate-400 text-center py-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                No valid transitions from this status.
              </p>
            ) : (
              allowedTransitions.map((status) => {
                const isSelected = selectedStatus === status;
                return (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-500/10' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className={`p-2 rounded-xl border ${getStatusColor(status)}`}>
                      {getStatusIcon(status)}
                    </div>
                    <span className={`font-bold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                      {status}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl h-12">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!selectedStatus || isSubmitting}
              className="rounded-xl h-12 bg-blue-600 hover:bg-blue-700 font-bold"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-5 w-5" />
              )}
              Confirm Transition
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
