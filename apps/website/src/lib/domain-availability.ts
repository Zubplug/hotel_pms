export type DomainAvailability = { domain: string; available: boolean; status: 'AVAILABLE' | 'REGISTERED' | 'UNKNOWN'; message: string; suggestions: string[] };

export function normalizeDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  const labels = domain.split('.');
  if (!domain || domain.length > 253 || labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return domain;
}

async function suggestions(domain: string): Promise<string[]> {
  const labels = domain.split('.');
  const suffix = labels.slice(-2).join('.');
  const name = labels.slice(0, -2).join('-');
  const candidates = [...new Set([`book-${name}.${suffix}`, `${name}-hotel.${suffix}`, `${name}-stay.${suffix}`, `${name}booking.${suffix}`, `${name}reservations.${suffix}`])].filter((candidate) => candidate !== domain);
  const result = await Promise.all(candidates.map(async (candidate) => {
    try {
      const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(candidate)}`, { headers: { accept: 'application/rdap+json, application/json', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, signal: AbortSignal.timeout(5000), cache: 'no-store' });
      return response.status === 404 ? candidate : null;
    } catch { return null; }
  }));
  return result.filter((candidate): candidate is string => Boolean(candidate));
}

export async function checkDomainAvailability(value: unknown): Promise<DomainAvailability> {
  const domain = normalizeDomain(value);
  if (!domain) return { domain: String(value || '').trim().toLowerCase(), available: false, status: 'UNKNOWN', message: 'Enter a valid domain such as book.example.com.', suggestions: [] };
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { headers: { accept: 'application/rdap+json, application/json', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, signal: AbortSignal.timeout(7000), cache: 'no-store' });
    if (response.status === 404) return { domain, available: true, status: 'AVAILABLE', message: 'This domain appears to be available.', suggestions: [] };
    if (response.ok || [400, 403].includes(response.status)) return { domain, available: false, status: 'REGISTERED', message: 'This domain is already registered or unavailable.', suggestions: await suggestions(domain) };
  } catch { /* Unknown is safer than allowing an unchecked domain into checkout. */ }
  return { domain, available: false, status: 'UNKNOWN', message: 'Availability could not be confirmed. Please try again.', suggestions: [] };
}
