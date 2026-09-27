import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getExternalAuditorScopes, isExternalAuditor } from '@/lib/auth/auditor-utils';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isExternalAuditor(session)) return NextResponse.json({ error: 'External auditor access required' }, { status: 403 });

  const scopes = await getExternalAuditorScopes(session.user.id);
  if (!scopes.length) return NextResponse.json({ error: 'No active audit engagement' }, { status: 403 });
  return NextResponse.json({ scopes }, { headers: { 'Cache-Control': 'no-store' } });
}
