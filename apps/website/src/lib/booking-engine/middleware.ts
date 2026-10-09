import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse } from '@/lib/api-response';
import { hasEntitlement } from '@/lib/auth/entitlement';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

export function originMatches(origin: string, allowedOrigins: string[]): boolean {
  let parsed: URL;
  try { parsed = new URL(origin); } catch { return false; }
  if (!['http:', 'https:'].includes(parsed.protocol) || (parsed.pathname !== '/' && parsed.pathname !== '')) return false;
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) return true;
    const match = allowed.match(/^(?:(https?):\/\/)?\*\.([^/]+)\/?$/i);
    if (!match) return false;
    const protocol = match[1]?.toLowerCase();
    const wildcardHost = match[2].toLowerCase();
    return (!protocol || parsed.protocol === `${protocol}:`) &&
      parsed.hostname !== wildcardHost && parsed.hostname.endsWith(`.${wildcardHost}`);
  });
}

export function corsHeaders(req: NextRequest, allowedOrigins: string[] = []): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = originMatches(origin, allowedOrigins) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Publishable-Key, X-Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export async function corsPreflightResponse(req: NextRequest): Promise<NextResponse> {
  const key = req.headers.get('x-publishable-key');
  if (!key) return new NextResponse(null, { status: 401, headers: corsHeaders(req, []) });
  const pk = await prisma.publishableKey.findUnique({ where: { key }, select: { status: true, allowedOrigins: true } });
  if (!pk || pk.status !== 'ACTIVE' || !originMatches(req.headers.get('origin') ?? '', pk.allowedOrigins)) {
    return new NextResponse(null, { status: 403, headers: corsHeaders(req, []) });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(req, pk.allowedOrigins) });
}

export function withCors(res: NextResponse, req: NextRequest): NextResponse {
  const hdrs = corsHeaders(req);
  Object.entries(hdrs).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

// ---------------------------------------------------------------------------
// Rate limiting uses Upstash Redis and fails closed when it is unavailable.
// ---------------------------------------------------------------------------

async function redisIncrement(key: string): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis rate limiter is not configured');
  const response = await fetch(`${url}/incr/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Redis returned ${response.status}`);
  const value = await response.json() as { result?: number };
  if (value.result === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/60`, { headers: { Authorization: `Bearer ${token}` } });
  }
  return value.result ?? 0;
}
const RATE_LIMIT = 30;        // requests
const RATE_WINDOW_MS = 60_000; // per 60 seconds

export async function checkRateLimit(ip: string, scope = 'public'): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return false;
  try {
    const bucket = `lodgecore:rate:${scope}:${ip}:${Math.floor(Date.now() / RATE_WINDOW_MS)}`;
    return (await redisIncrement(bucket)) <= RATE_LIMIT;
  } catch {
    return false;
  }
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}

// ---------------------------------------------------------------------------
// Property + config resolution
// ---------------------------------------------------------------------------

export interface ResolvedBookingContext {
  property: {
    id: string;
    organizationId: string;
    name: string;
    currency: string;
    businessDate: Date | null;
    timezone: string;
    isActive: boolean;
  };
  config: {
    id: string;
    enabled: boolean;
    publicSlug: string;
    paymentMode: string;
    allowedRatePlanIds: string[];
    minStay: number;
    maxStay: number | null;
    bookingLeadTimeHours: number;
    maxAdvanceDays: number | null;
  };
  site: {
    siteName: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    status: string;
  };
}

/**
 * Resolve and validate a property by its public booking slug.
 * Throws a typed NextResponse error if the property or engine is not accessible.
 */
export async function resolveBookingContext(slug: string): Promise<ResolvedBookingContext | NextResponse> {
  const config = await (prisma.bookingEngineConfig.findUnique as any)({
    where: { publicSlug: slug },
    include: {
      property: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          baseCurrency: true,
          businessDate: true,
          timezone: true,
          isActive: true,
          suspendedAt: true,
        },
      },
    },
  });

  if (!config) {
    return errorResponse('NOT_FOUND', 'Booking site not found', 404);
  }

  const prop = config.property;
  const site = await prisma.bookingSite.findUnique({
    where: { propertyId: prop.id },
    select: { siteName: true, logoUrl: true, primaryColor: true, secondaryColor: true, status: true },
  });

  const entitled = await hasEntitlement(prop.organizationId, 'ADDON_BOOKING_ENGINE', prop.id);
  if (!entitled) return errorResponse('PAYMENT_REQUIRED', 'Online booking is not available for this property', 402);

  if (!prop.isActive || prop.suspendedAt) {
    return errorResponse('GONE', 'This property is not currently accepting bookings', 410);
  }

  if (!config.enabled) {
    return errorResponse('SERVICE_UNAVAILABLE', 'Online booking is not enabled for this property', 503);
  }

  if (!site || site.status !== 'PUBLISHED') {
    return errorResponse('NOT_FOUND', 'Booking site not found', 404);
  }

  return {
    property: {
      id: prop.id,
      organizationId: prop.organizationId,
      name: prop.name,
      currency: prop.baseCurrency,
      businessDate: prop.businessDate,
      timezone: prop.timezone,
      isActive: prop.isActive,
    },
    config: {
      id: config.id,
      enabled: config.enabled,
      publicSlug: config.publicSlug,
      paymentMode: config.paymentMode,
      allowedRatePlanIds: config.allowedRatePlanIds,
      minStay: config.minStay,
      maxStay: config.maxStay,
      bookingLeadTimeHours: config.bookingLeadTimeHours,
      maxAdvanceDays: config.maxAdvanceDays,
    },
    site,
  };
}

export function isErrorResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

export interface IntegrationContext {
  organizationId: string;
  propertyId: string;
  publishableKey: string;
  environment: string;
  allowedOrigins: string[];
}

/**
 * Resolves a public integration context from the X-Publishable-Key header.
 * Validates the origin against the key's allowed origins list.
 */
export async function resolvePublicApiContext(req: NextRequest): Promise<IntegrationContext | NextResponse> {
  const key = req.headers.get('x-publishable-key');
  if (!key) {
    return errorResponse('UNAUTHORIZED', 'Missing X-Publishable-Key header', 401);
  }

  const pk = await prisma.publishableKey.findUnique({
    where: { key },
    include: {
      integration: {
        select: {
          organizationId: true,
          propertyId: true,
          status: true,
          property: { select: { isActive: true, suspendedAt: true, organizationId: true } }
        }
      }
    }
  });

  if (!pk || pk.status !== 'ACTIVE' || pk.integration.status !== 'ACTIVE' || pk.integration.organizationId !== pk.integration.property.organizationId) {
    return errorResponse('UNAUTHORIZED', 'Invalid or inactive publishable key', 401);
  }

  const origin = req.headers.get('origin');
  if (pk.allowedOrigins.length > 0 && origin) {
    // Wildcard prefix match or exact match
    const isAllowed = originMatches(origin, pk.allowedOrigins);
    if (!isAllowed) {
      return errorResponse('FORBIDDEN', 'Origin not allowed for this integration', 403);
    }
  } else if (pk.allowedOrigins.length === 0) {
    return errorResponse('FORBIDDEN', 'No origins configured for this integration', 403);
  }

  if (!pk.integration.property.isActive || pk.integration.property.suspendedAt) {
    return errorResponse('GONE', 'This property is not currently active', 410);
  }

  // Update last used asynchronously
  prisma.publishableKey.update({
    where: { id: pk.id },
    data: { lastUsedAt: new Date() }
  }).catch(() => null);

  return {
    organizationId: pk.integration.organizationId,
    propertyId: pk.integration.propertyId,
    publishableKey: pk.key,
    environment: pk.environment,
    allowedOrigins: pk.allowedOrigins,
  };
}
