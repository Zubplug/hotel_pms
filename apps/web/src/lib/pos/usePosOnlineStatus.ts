import { useEffect, useState, useCallback, useRef } from 'react';
import { OfflineSyncQueue } from './OfflineSyncQueue';

interface UsePosOnlineStatusOptions {
  onBackOnline?: () => void;
}

interface PosOnlineStatus {
  isOnline: boolean;
  syncPending: number;
}

export function usePosOnlineStatus(
  options: UsePosOnlineStatusOptions = {}
): PosOnlineStatus {
  const { onBackOnline } = options;

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncPending, setSyncPending] = useState<number>(OfflineSyncQueue.size());

  // Keep a stable ref to the callback so the event listener doesn't go stale
  const onBackOnlineRef = useRef(onBackOnline);
  useEffect(() => {
    onBackOnlineRef.current = onBackOnline;
  }, [onBackOnline]);

  const refreshPending = useCallback(() => {
    setSyncPending(OfflineSyncQueue.size());
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshPending();
      onBackOnlineRef.current?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll queue size every 5 seconds
    const intervalId = setInterval(refreshPending, 5_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [refreshPending]);

  return { isOnline, syncPending };
}
