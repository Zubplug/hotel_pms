import { NextRequest, NextResponse } from 'next/server';

/** Server-side campaign link for the standalone hotel website. */
export async function GET(req: NextRequest) {
  const campaign = req.nextUrl.searchParams.get('campaign')?.trim();
  if (!campaign) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });

  const apiUrl = process.env.LC_API_URL ?? 'https://getlodgecore.vercel.app/api/v1/public';
  const publishableKey = process.env.LC_PUBLISHABLE_KEY;
  if (!publishableKey) return NextResponse.json({ error: 'Referral links are not configured' }, { status: 503 });

  const response = await fetch(`${apiUrl}/reach/click`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Publishable-Key': publishableKey,
      Origin: process.env.PUBLIC_SITE_ORIGIN ?? req.nextUrl.origin,
    },
    body: JSON.stringify({ campaign, landingPath: '/booking' }),
    cache: 'no-store',
  });
  if (!response.ok) return NextResponse.json({ error: 'Campaign is unavailable' }, { status: response.status });

  const payload = await response.json() as { data?: { referralToken?: string } };
  const token = payload.data?.referralToken;
  if (!token) return NextResponse.json({ error: 'Campaign response was invalid' }, { status: 502 });

  const destination = new URL('/booking', req.url);
  destination.searchParams.set('reach', token);
  return NextResponse.redirect(destination);
}
