const STORAGE_KEY = 'lodgecore:notification-acknowledgements';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type StoredAcknowledgements = Record<string, number>;

function storageKey(scope: string, id: string): string {
  return `${scope}:${id}`;
}

function readStored(): StoredAcknowledgements {
  if (typeof window === 'undefined') return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as StoredAcknowledgements;
    const now = Date.now();
    const active = Object.entries(raw).filter(([, timestamp]) => now - Number(timestamp) < MAX_AGE_MS);
    const cleaned = Object.fromEntries(active);
    if (active.length !== Object.keys(raw).length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function readAcknowledgements(scope: string): Set<string> {
  return new Set(
    Object.keys(readStored())
      .filter((key) => key.startsWith(`${scope}:`))
      .map((key) => key.slice(scope.length + 1)),
  );
}

export function rememberAcknowledgement(scope: string, id: string, acknowledged = readStored()): void {
  acknowledged[storageKey(scope, id)] = Date.now();
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(acknowledged));
  } catch {
    // In-memory callers still suppress replay for the current mount.
  }
}
