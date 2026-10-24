import { cookies } from 'next/headers';

export async function publicCorporateApplication<T>(path: string, init: RequestInit = {}) {
  const baseUrl = (process.env.CORPORATE_API_URL || 'https://getlodgecore.vercel.app').replace(/\/$/, '');
  const key = process.env.LC_PUBLISHABLE_KEY;
  const jar = await cookies();
  const applicationId = jar.get('stanzel_corporate_application_id')?.value;
  const applicationToken = jar.get('stanzel_corporate_application_token')?.value;
  if (!key || !applicationId || !applicationToken) return { ok: false as const, error: 'Corporate application access has expired. Please start again.', status: 401, hasApplicationCredentials: false };
  const url = new URL(path, `${baseUrl}/`);
  let requestBody = init.body;
  if ((init.method || 'GET').toUpperCase() === 'GET') { url.searchParams.set('applicationId', applicationId); url.searchParams.set('applicationToken', applicationToken); }
  else { const parsed = typeof requestBody === 'string' ? JSON.parse(requestBody || '{}') : {}; requestBody = JSON.stringify({ ...parsed, applicationId, applicationToken }); }
  const response = await fetch(url, { ...init, body: requestBody, headers: { 'x-publishable-key': key, accept: 'application/json', 'content-type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false as const, error: responseBody?.error?.message || responseBody?.message || 'Corporate API request failed.', status: response.status, hasApplicationCredentials: true };
  return { ok: true as const, data: responseBody?.data ?? responseBody, status: response.status, applicationId, applicationToken, hasApplicationCredentials: true };
}

/** A Stanzel application session is deliberately exclusive of a portal session. */
export async function hasPublicCorporateApplication() {
  const jar = await cookies();
  return Boolean(jar.get('stanzel_corporate_application_id')?.value && jar.get('stanzel_corporate_application_token')?.value);
}

export function applicationCredentials(jar: { get(name: string): { value: string } | undefined }) {
  const applicationId = jar.get('stanzel_corporate_application_id')?.value;
  const applicationToken = jar.get('stanzel_corporate_application_token')?.value;
  return applicationId && applicationToken ? { applicationId, applicationToken } : null;
}
