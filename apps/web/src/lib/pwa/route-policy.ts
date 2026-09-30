/** Online PWA routes. Desktop-owned Front Desk/POS routes are excluded. */
export const PWA_EXCLUDED_PREFIXES = ['/frontdesk', '/pos', '/desktop', '/admin/pos'] as const;

export const PWA_ONLINE_PREFIXES = [
  '/admin', '/accountant', '/cash-management', '/external-auditor', '/fnb',
  '/general-manager', '/housekeeping', '/hub', '/inventory',
  '/maintenance', '/night-audit', '/reports', '/reservations', '/properties',
  '/rooms', '/room-types', '/amenities', '/refunds', '/settings', '/staff',
  '/sync-center',
] as const;

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPwaExcludedPath(pathname: string): boolean {
  return PWA_EXCLUDED_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}

export function isPwaEligiblePath(pathname: string): boolean {
  return !isPwaExcludedPath(pathname) && PWA_ONLINE_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix));
}
