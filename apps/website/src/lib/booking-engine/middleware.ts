import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse } from '@/lib/api-response';
import { hasEntitlement } from '@/lib/auth/entitlement';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://book.lodgecore.com',
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:3001', 'http://localhost:3000']
    : []),
];

export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function corsPreflightResponse(req: NextRequest): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export function withCors(res: NextResponse, req: NextRequest): NextResponse {
  const hdrs = corsHeaders(req);
  Object.entries(hdrs).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory sliding window — replace with Redis in prod)
// ---------------------------------------------------------------------------

const ipWindows = new Map<string, number[]>();
const RATE_LIMIT = 30;        // requests
const RATE_WINDOW_MS = 60_000; // per 60 seconds

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = (ipWindows.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  window.push(now);
  ipWindows.set(ip, window);
  return window.length <= RATE_LIMIT;
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

