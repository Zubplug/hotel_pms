import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { authenticateSyncRequest } from '@/lib/sync-auth';

/**
 * Lightweight desktop safety check used immediately before POS login.
 * This deliberately returns only the property control state. Full data
 * synchronization remains the responsibility of the background sync engine.
 */
export async function GET(req: NextRequest) {
  try {
    const propertyId = req.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    const authResult = await authenticateSyncRequest(req, propertyId);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        businessDate: true,
        auditStatus: true,
        lastAuditAt: true,
        timezone: true,
      },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      property,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[sync/control-state] Error:', error);
    return NextResponse.json({ error: 'Unable to refresh terminal control state' }, { status: 500 });
  }
}
