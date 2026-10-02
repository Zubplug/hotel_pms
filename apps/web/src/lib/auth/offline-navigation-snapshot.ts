import { NAVIGATION_MODULES, type NavigationModule } from './navigation-modules';

const STORAGE_PREFIX = 'lodgecore:navigation-modules:';

export type OfflineLicenseSnapshot = {
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'RESTRICTED' | 'UNKNOWN';
  expiresAt: string | null;
  capturedAt: string;
};

function storageKey(propertyId?: string | null) {
  return `${STORAGE_PREFIX}${propertyId || 'default'}`;
}

function normalizeModules(value: unknown): NavigationModule[] {
  if (!Array.isArray(value)) return [];
  return value.filter((module): module is NavigationModule =>
    NAVIGATION_MODULES.includes(module as NavigationModule),
  );
}

/**
 * The desktop shell has its own local database and license enforcement. This
 * browser-side snapshot is only for rendering navigation while offline; it is
 * never an authorization decision and must not be used by API routes.
 */
export function readOfflineNavigationSnapshot(propertyId?: string | null): NavigationModule[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (raw) {
      const parsed = JSON.parse(raw) as { modules?: unknown };
      return normalizeModules(parsed.modules);
    }

    // A property-specific snapshot may not exist on first launch. The default
    // snapshot is populated by the server-rendered workspace shell and is a
    // safe fallback for the currently selected desktop workspace.
    if (propertyId) {
      const fallback = window.localStorage.getItem(storageKey());
      if (fallback) {
        const parsed = JSON.parse(fallback) as { modules?: unknown };
        return normalizeModules(parsed.modules);
      }
    }
  } catch {
    // Corrupt local UI state must never prevent the desktop from opening.
  }

  return [];
}

export function readOfflineLicenseSnapshot(propertyId?: string | null): OfflineLicenseSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(storageKey(propertyId));
    if (!raw && propertyId) return readOfflineLicenseSnapshot();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { license?: OfflineLicenseSnapshot };
    return parsed.license ?? null;
  } catch {
    return null;
  }
}

export function writeOfflineNavigationSnapshot(
  modules: readonly string[],
  propertyId?: string | null,
  license?: OfflineLicenseSnapshot | null,
) {
  if (typeof window === 'undefined') return;

  try {
    const existing = readOfflineLicenseSnapshot(propertyId);
    const safeModules = normalizeModules(modules);
    window.localStorage.setItem(storageKey(propertyId), JSON.stringify({
      modules: safeModules,
      capturedAt: new Date().toISOString(),
      license: license ?? existing ?? undefined,
    }));
  } catch {
    // localStorage may be unavailable in a restricted WebView profile.
  }
}
