import { describe, expect, it } from 'vitest';

import { isPwaEligiblePath, isPwaExcludedPath } from './route-policy';

describe('PWA route policy', () => {
  it.each(['/frontdesk', '/frontdesk/reservations', '/pos', '/pos/kds', '/desktop', '/desktop/setup-sync', '/admin/pos/menu'])('excludes desktop-owned route %s', (pathname) => {
    expect(isPwaExcludedPath(pathname)).toBe(true);
    expect(isPwaEligiblePath(pathname)).toBe(false);
  });

  it.each(['/accountant', '/accountant/gl', '/external-auditor/reports', '/inventory', '/fnb/dashboard', '/cash-management', '/general-manager', '/night-audit/reports', '/hq'])('allows online route %s', (pathname) => {
    expect(isPwaEligiblePath(pathname)).toBe(true);
  });

  it('does not exclude similarly named routes', () => {
    expect(isPwaExcludedPath('/pos-control')).toBe(false);
    expect(isPwaExcludedPath('/frontdesk-reports')).toBe(false);
  });

  it('gives desktop-owned routes precedence over broad online prefixes', () => {
    expect(isPwaEligiblePath('/admin/pos/menu')).toBe(false);
    expect(isPwaEligiblePath('/admin/external-auditors')).toBe(true);
  });
});
