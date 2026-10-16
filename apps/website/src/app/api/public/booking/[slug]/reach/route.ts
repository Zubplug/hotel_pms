import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { recordReachClick } from '@/lib/reach-attribution';
import { resolveBookingContext, isErrorResponse } from '@/lib/booking-engine/middleware';

function safeWebsite(value: string | null | undefined) {
  try {
    const url = new URL(value || '');
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Track a Reach campaign click and send the visitor to the appropriate guest destination. */
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
      // An active campaign should still open the booking page when partner
      // verification or Reach attribution is temporarily unavailable. The
      // click is simply not attributed until the eligibility checks pass.
      where: { propertyId: context.property.id, code: campaignCode, isActive: true },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ error: 'Campaign is unavailable' }, { status: 404 });
  }

  // Standalone API customers own the guest-facing website, so Reach should
  // open that site instead of sending guests to LodgeCore's booking engine.
  // The token is retained so an API-backed website can pass it through when
  // it creates the reservation.
  const standaloneWebsite = await prisma.property.findUnique({
    where: { id: context.property.id },
    select: {
      website: true,
      propertyIntegrations: {
        where: { provider: 'CUSTOM_WEBSITE', status: 'ACTIVE' },
        select: { id: true },
        take: 1,
      },
    },
  });
  const websiteDestination = standaloneWebsite?.propertyIntegrations.length
    ? safeWebsite(standaloneWebsite.website)
    : null;
  const destination = websiteDestination ?? new URL(`/book/${encodeURIComponent(slug)}`, req.url);
  if (click) destination.searchParams.set('reach', click.referralToken);
  return NextResponse.redirect(destination);
}
