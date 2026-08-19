const STORAGE_KEY = 'lodgecore_pos_sync_queue';

export type QueuedEvent = {
  id: string;         // crypto.randomUUID()
  type: string;       // e.g. 'pos.keepAlive', 'pos.operatorSession', 'pos.payment'
  payload: object;    // the data to retry
  createdAt: number;  // Date.now()
  attempts: number;   // retry count
  maxAttempts: number; // default 5
};

export class OfflineSyncQueue {
  /** Read all queued events from localStorage. */
  static getAll(): QueuedEvent[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as QueuedEvent[];
    } catch {
      return [];
    }
  }

  /** Persist the full list back to localStorage. */
  private static _save(events: QueuedEvent[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {
      // Quota exceeded or private browsing – silently ignore
    }
  }

  /** Add an event to the end of the queue. */
  static add(event: QueuedEvent): void {
    const events = OfflineSyncQueue.getAll();
    events.push(event);
    OfflineSyncQueue._save(events);
  }

  /** Remove a single event by its id. */
  static remove(id: string): void {
    const events = OfflineSyncQueue.getAll().filter((e) => e.id !== id);
    OfflineSyncQueue._save(events);
  }

  /** Clear all pending events. */
  static clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /** Return the number of pending events. */
  static size(): number {
    return OfflineSyncQueue.getAll().length;
  }
}
