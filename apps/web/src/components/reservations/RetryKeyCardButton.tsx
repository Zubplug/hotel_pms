'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface RetryKeyCardButtonProps {
  reservation: {
    id: string;
    roomId?: string;
    reservationRooms?: Array<{ roomId?: string; room?: { id?: string } }>;
  };
  label?: string;
  className?: string;
}

export function RetryKeyCardButton({ reservation, label = 'Retry Card', className }: RetryKeyCardButtonProps) {
  const router = useRouter();
  const { provider } = useLodgeCoreProvider();
  const [busy, setBusy] = useState(false);

  const retryEncoding = async () => {
    const roomId = reservation?.reservationRooms?.[0]?.room?.id
      || reservation?.reservationRooms?.[0]?.roomId
      || reservation?.roomId;

    if (!roomId) {
      toast.error('No assigned room is available for card encoding.');
      return;
    }

    setBusy(true);
    try {
      const result = await provider.keycards.encode(roomId, '', reservation.id);
      if (!result?.success || result?.error) {
        throw new Error(result?.error?.message || result?.error || 'Card encoding failed.');
      }

      toast.success('Card encoding retry started.');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Card encoding failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="outline" onClick={retryEncoding} disabled={busy} className={className}>
      <RefreshCw className={busy ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
      {busy ? 'Retrying...' : label}
    </Button>
  );
}
