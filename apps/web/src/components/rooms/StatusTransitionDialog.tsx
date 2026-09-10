'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAllowedTransitions, RoomStatus } from '@/lib/room-state-machine';

interface StatusTransitionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentStatus: string;
  onSuccess?: () => void;
}

export function StatusTransitionDialog({
  isOpen,
  onClose,
  roomId,
  currentStatus,
  onSuccess,
}: StatusTransitionDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowedTransitions = getAllowedTransitions(currentStatus as RoomStatus);

  async function handleConfirm() {
    if (!selectedStatus) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/rooms/${roomId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus: selectedStatus, source: 'MANUAL' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || 'Failed to update status');
      }
      toast.success(`Room status updated to ${selectedStatus}`);
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="overflow-hidden border-slate-200 p-0 shadow-2xl sm:max-w-md">
        <DialogHeader>
          <div className="border-b bg-gradient-to-br from-slate-50 to-white px-6 pb-5 pt-6">
            <DialogTitle className="text-xl tracking-tight">Update room status</DialogTitle>
            <DialogDescription className="mt-1">Choose the next operational state for this room.</DialogDescription>
          </div>
        </DialogHeader>

        <div className="mx-6 mt-5 flex items-center justify-between rounded-2xl border bg-muted/20 p-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Current status</p><div className="mt-2"><StatusBadge status={currentStatus} /></div></div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">New status</p><div className="mt-2">{selectedStatus ? <StatusBadge status={selectedStatus} /> : <span className="text-sm text-muted-foreground">Select below</span>}</div></div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 py-5">
          {allowedTransitions.length === 0 ? (
            <p className="col-span-2 text-sm text-muted-foreground text-center py-4">
              No valid transitions from this status.
            </p>
          ) : (
            allowedTransitions.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`rounded-xl border p-3 text-left text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm ${
                  selectedStatus === status ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : ''
                }`}
              >
                <StatusBadge status={status} />
              </button>
            ))
          )}
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button className="min-w-32" onClick={handleConfirm} disabled={!selectedStatus || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Transition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
