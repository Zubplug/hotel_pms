import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { reachVisitorId, recordReachClick } from '@/lib/reach-attribution';

function safeWebsite(value: string | null | undefined) {
  try {
    const url = new URL(value || '');
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Track a generic Reach referral and send the visitor to the property's website. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const campaign = await prisma.referralCampaign.findFirst({
    where: { code: code.trim(), isActive: true },
    select: { propertyId: true, property: { select: { website: true } } },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaign is unavailable' }, { status: 404 });

  const visitorId = reachVisitorId(req);
  await recordReachClick(prisma, { propertyId: campaign.propertyId, campaignCode: code, landingPath: req.nextUrl.pathname, visitorId, userAgent: req.headers.get('user-agent') });
  const destination = safeWebsite(campaign.property.website);
  if (!destination) return NextResponse.json({ error: 'This property has no valid website destination' }, { status: 409 });
  const response = NextResponse.redirect(destination);
  response.cookies.set('reach_visitor', visitorId, { httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', maxAge: 60 * 60 * 24 * 365, path: '/' });
  return response;
}
