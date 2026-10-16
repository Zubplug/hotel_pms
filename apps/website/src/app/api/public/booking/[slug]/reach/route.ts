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
  // Always resolve the booking destination on the current deployment. A
  // campaign may have been created with an older NEXT_PUBLIC_SITE_URL, and
  // redirecting to that stored origin can make an otherwise valid link fail.
  // Only attach the Reach token when the campaign is currently attributable.
  if (!click) {
    const campaign = await prisma.referralCampaign.findFirst({
      where: { propertyId: context.property.id, code: campaignCode, isActive: true, program: { enabled: true } },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign is unavailable' }, { status: 404 });
  }

  const destination = new URL(`/book/${encodeURIComponent(slug)}`, req.url);
  if (click) destination.searchParams.set('reach', click.referralToken);
  return NextResponse.redirect(destination);
}
