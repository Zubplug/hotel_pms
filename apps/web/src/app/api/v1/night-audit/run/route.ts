import { NextResponse } from 'next/server';
import { executeNightAudit } from '@/lib/night-audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { propertyId, userId, userEmail } = body;
    const result = await executeNightAudit(
      propertyId,
      userId || null,
      userEmail || 'manual@lodgecore.local',
      'SYSTEM'
    );

    return NextResponse.json({ success: true, message: 'Night audit completed successfully', ...result }, { status: 200 });

  } catch (error: any) {
    console.error('Night Audit Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
