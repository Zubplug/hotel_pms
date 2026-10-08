export type DomainAvailability = {
  domain: string;
  available: boolean;
  status: 'AVAILABLE' | 'REGISTERED' | 'UNKNOWN';
  message: string;
  suggestions: string[];
};

export function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase().replace(/\.$/, '');
  if (!candidate || candidate.length > 253 || candidate.includes('://') || candidate.includes('/')) return null;
  const labels = candidate.split('.');
  if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return candidate;
}

export async function checkDomainAvailability(value: unknown): Promise<DomainAvailability> {
  const domain = normalizeDomain(value);
  if (!domain) {
    return { domain: String(value || '').trim().toLowerCase(), available: false, status: 'UNKNOWN', message: 'Enter a valid domain such as booking.example.com.', suggestions: [] };
  }

  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: 'application/rdap+json, application/json' },
      signal: AbortSignal.timeout(7000),
      cache: 'no-store',
    });

    if (response.status === 404) {
      return { domain, available: true, status: 'AVAILABLE', message: 'This domain appears to be available.', suggestions: [] };
    }
    if (response.ok || response.status === 400 || response.status === 403) {
      return { domain, available: false, status: 'REGISTERED', message: 'This domain is already registered or cannot be transferred.', suggestions: await suggestAvailableDomains(domain) };
    }
  } catch {
    // Treat provider/network failures as unknown. Never sell or request an unchecked domain.
  }

  return { domain, available: false, status: 'UNKNOWN', message: 'Availability could not be confirmed right now. Please try again.', suggestions: [] };
}

async function suggestAvailableDomains(domain: string): Promise<string[]> {
  const labels = domain.split('.');
  const suffix = labels.slice(-2).join('.');
  const name = labels.slice(0, -2).join('-');
  const candidates = [...new Set([
    `book-${name}.${suffix}`,
    `${name}-hotel.${suffix}`,
    `${name}-stay.${suffix}`,
    `${name}booking.${suffix}`,
    `${name}reservations.${suffix}`,
  ])].filter((candidate) => candidate !== domain && normalizeDomain(candidate));

  const results = await Promise.all(candidates.map(async (candidate) => {
    try {
      const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(candidate)}`, {
        headers: { accept: 'application/rdap+json, application/json' },
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
      });
      return response.status === 404 ? candidate : null;
    } catch {
      return null;
    }
  }));
  return results.filter((candidate): candidate is string => Boolean(candidate)).slice(0, 5);
}
