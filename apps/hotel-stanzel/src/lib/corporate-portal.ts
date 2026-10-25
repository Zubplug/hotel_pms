import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

function configuration() {
  const baseUrl = process.env.CORPORATE_API_URL || 'https://getlodgecore.vercel.app';
  return { baseUrl: baseUrl.replace(/\/$/, ''), propertyId: process.env.CORPORATE_PROPERTY_ID || null };
}

async function resolvePropertyId(baseUrl: string, token: string, configuredId: string | null) {
  if (configuredId) return configuredId;
  const response = await fetch(new URL('/api/v1/corporate/properties', `${baseUrl}/`), { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  const properties = body?.data?.properties || body?.properties || [];
  if (!Array.isArray(properties) || properties.length !== 1) return null;
  return properties[0]?.id || null;
}

export async function corporateApi<T>(path: string): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status?: number }> {
  if (!(await cookies()).get('stanzel_corporate_token')?.value) redirect('/corporate/login');
  const result = await corporateApiRequest<T>(path);
  if (!result.ok && result.status === 401) redirect('/corporate/login');
  return result;
}

export async function corporateApiRequest<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status?: number }> {
  const config = configuration();
  const token = (await cookies()).get('stanzel_corporate_token')?.value;
  if (!config || !token) return { ok: false, error: 'Corporate portal access is not configured or you are not signed in.' };
  const propertyId = await resolvePropertyId(config.baseUrl, token, config.propertyId);
  if (!propertyId) return { ok: false, error: 'The corporate credential must map to exactly one Stanzel property.' };
  const url = new URL(path, `${config.baseUrl}/`);
  if (!url.searchParams.has('propertyId')) url.searchParams.set('propertyId', propertyId);
  try {
    const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'content-type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: body?.error?.message || body?.message || 'Corporate API request failed.', status: response.status };
    return { ok: true, data: body?.data ?? body, status: response.status };
  } catch { return { ok: false, error: 'Corporate API is temporarily unavailable.' }; }
}

export async function publicCorporateAuthRequest<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T; status: number } | { ok: false; error: string; status?: number }> {
  const baseUrl = process.env.CORPORATE_API_URL || 'https://getlodgecore.vercel.app';
  const publishableKey = process.env.LC_PUBLISHABLE_KEY;
  if (!publishableKey) return { ok: false, error: 'Public booking API is not configured.' };
  try {
    const response = await fetch(new URL(path, `${baseUrl.replace(/\/$/, '')}/`), { ...init, headers: { 'x-publishable-key': publishableKey, accept: 'application/json', 'content-type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: body?.error?.message || body?.message || 'Corporate authentication request failed.', status: response.status };
    return { ok: true, data: body?.data ?? body, status: response.status };
  } catch { return { ok: false, error: 'Corporate API is temporarily unavailable.' }; }
}

export const publicCorporateApiRequest = publicCorporateAuthRequest;

export function corporateApiConfiguration() {
  const config = configuration();
  return config ? { baseUrl: config.baseUrl, propertyId: config.propertyId } : null;
}

export async function resolveStanzelPropertyId(token: string) {
  const config = configuration();
  if (!config) return null;
  return resolvePropertyId(config.baseUrl, token, config.propertyId);
}

export async function getStanzelPropertyId() {
  const token = (await cookies()).get('stanzel_corporate_token')?.value;
  return token ? resolveStanzelPropertyId(token) : null;
}
