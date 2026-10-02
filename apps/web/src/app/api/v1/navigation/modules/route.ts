import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNavigationModules } from '@/lib/auth/navigation-entitlements';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    return NextResponse.json({ modules: await getNavigationModules(session.user.id, propertyId) });
  } catch {
    return NextResponse.json({ error: 'Unable to resolve module access' }, { status: 403 });
  }
}
