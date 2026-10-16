import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { recordReachClick } from '@/lib/reach-attribution';
import { resolveBookingContext, isErrorResponse } from '@/lib/booking-engine/middleware';

/** Track a Reach campaign click and send the visitor into the existing booking flow. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const campaignCode = req.nextUrl.searchParams.get('campaign')?.trim();
  if (!campaignCode) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });

  const context = await resolveBookingContext(slug);
  if (isErrorResponse(context)) return context;

  const click = await recordReachClick(prisma, {
    propertyId: context.property.id,
    campaignCode,
    landingPath: req.nextUrl.pathname,
  });
  if (!click) return NextResponse.json({ error: 'Campaign is unavailable' }, { status: 404 });

  const destination = new URL(click.targetUrl || `/book/${slug}`, req.url);
  destination.searchParams.set('reach', click.referralToken);
  return NextResponse.redirect(destination);
}
