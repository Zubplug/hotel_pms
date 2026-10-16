import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import {
  corsHeaders,
  corsPreflightResponse,
  resolvePublicApiContext,
  isErrorResponse,
  checkRateLimit,
  rateLimitIdentity,
} from '@/lib/booking-engine/middleware';
import { recordReachClick } from '@/lib/reach-attribution';

export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}

export async function POST(req: NextRequest) {
  const ip = rateLimitIdentity(req);
  if (!(await checkRateLimit(ip, 'reach-clicks'))) {
    return new Response(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), { status: 429, headers: corsHeaders(req) });
  }

  const ctx = await resolvePublicApiContext(req);
  if (isErrorResponse(ctx)) return ctx;

  let body: { campaign?: unknown; landingPath?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400);
  }
  const campaignCode = typeof body.campaign === 'string' ? body.campaign.trim() : '';
  if (!campaignCode || campaignCode.length > 100) return errorResponse('BAD_REQUEST', 'campaign is required', 400);

  const click = await recordReachClick(prisma, {
    propertyId: ctx.propertyId,
    campaignCode,
    landingPath: typeof body.landingPath === 'string' ? body.landingPath.slice(0, 512) : null,
    visitorId: req.headers.get('x-reach-visitor-id'),
    userAgent: req.headers.get('user-agent'),
  });
  if (!click) return errorResponse('NOT_FOUND', 'Campaign is unavailable', 404);

  const response = successResponse({ referralToken: click.referralToken, expiresAt: click.expiresAt });
  Object.entries(corsHeaders(req, ctx.allowedOrigins)).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
