// GET /api/public/booking/[slug]/config
// Returns the public booking engine configuration for a property.
// No authentication required.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import {
  corsHeaders,
  corsPreflightResponse,
  resolveBookingContext,
  isErrorResponse,
  checkRateLimit,
  clientIp,
} from '@/lib/booking-engine/middleware';

export async function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return new NextResponse(JSON.stringify({ error: 'TOO_MANY_REQUESTS' }), {
      status: 429,
      headers: corsHeaders(req),
    });
  }

  const ctx = await resolveBookingContext(slug);
  if (isErrorResponse(ctx)) return ctx;

  // Load public site branding
  const site = await prisma.bookingSite.findUnique({
    where: { propertyId: ctx.property.id },
    select: {
      siteName: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
      theme: true,
      content: true,
      templateKey: true,
      status: true,
    },
  });

  // Load exposed rate plans
  const ratePlanWhere: any = {
    propertyId: ctx.property.id,
    isActive: true,
    isPublic: true,
    deletedAt: null,
  };
  if (ctx.config.allowedRatePlanIds.length > 0) {
    ratePlanWhere.id = { in: ctx.config.allowedRatePlanIds };
  }

  const ratePlans = await prisma.ratePlan.findMany({
    where: ratePlanWhere,
    select: {
      id: true,
      name: true,
      code: true,
      description: true,
      type: true,
      minStay: true,
      maxStay: true,
      advanceBookingDays: true,
      cancellationPolicy: {
        select: {
          id: true,
          name: true,
          type: true,
          hoursBeforeCheckIn: true,
          penaltyType: true,
          penaltyValue: true,
        },
      },
      depositPolicy: {
        select: {
          id: true,
          name: true,
          type: true,
          value: true,
          required: true,
          dueAtBooking: true,
        },
      },
    },
  });

  const res = successResponse(
    {
      property: {
        name: ctx.property.name,
        currency: ctx.property.currency,
        timezone: ctx.property.timezone,
      },
      booking: {
        paymentMode: ctx.config.paymentMode,
        minStay: ctx.config.minStay,
        maxStay: ctx.config.maxStay,
        bookingLeadTimeHours: ctx.config.bookingLeadTimeHours,
        maxAdvanceDays: ctx.config.maxAdvanceDays,
      },
      site: site ?? null,
      ratePlans,
    },
    200
  );

  Object.entries(corsHeaders(req)).forEach(([k, v]) => res.headers.set(k, v));
  // Cache for 5 min at the CDN — config changes are not time-critical
  res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return res;
}


