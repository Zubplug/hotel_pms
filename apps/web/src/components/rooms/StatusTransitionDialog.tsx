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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Room Status</DialogTitle>
          <DialogDescription>
            Select a new status to transition to from the current state.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <StatusBadge status={currentStatus} />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          {selectedStatus ? (
            <StatusBadge status={selectedStatus} />
          ) : (
            <span className="text-sm text-muted-foreground italic">Select status below</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {allowedTransitions.length === 0 ? (
            <p className="col-span-2 text-sm text-muted-foreground text-center py-4">
              No valid transitions from this status.
            </p>
          ) : (
            allowedTransitions.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`rounded-lg border p-3 text-left text-sm transition-all hover:border-primary/50 hover:bg-primary/5 ${
                  selectedStatus === status ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : ''
                }`}
              >
                <StatusBadge status={status} />
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedStatus || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Transition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
