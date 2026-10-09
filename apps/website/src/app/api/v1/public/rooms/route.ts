import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse } from '@/lib/api-response';
import {
  corsHeaders,
  corsPreflightResponse,
  resolvePublicApiContext,
  isErrorResponse,
  checkRateLimit,
  clientIp,
} from '@/lib/booking-engine/middleware';

export async function OPTIONS(req: NextRequest) {
  return await corsPreflightResponse(req);
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (!(await checkRateLimit(ip, 'rooms'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  const roomTypes = await prisma.roomType.findMany({
    where: { propertyId: ctx.propertyId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      maxOccupancy: true,
      baseRate: true,
      currency: true,
      photos: true,
      amenities: true,
    },
    orderBy: { name: 'asc' }
  });

  const res = successResponse({ data: roomTypes }, 200);
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([k, v]) => res.headers.set(k, v));
  // Room types change infrequently
  res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res;
}
