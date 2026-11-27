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

    // POS login only needs the shift control projection. Keep this endpoint
    // intentionally small: it must not pull reservations, inventory, folios,
    // or the general desktop sync feed before a cashier can sign in.
    const terminal = authResult.isDevice && authResult.deviceId
      ? await prisma.posTerminal.findUnique({ where: { id: authResult.deviceId }, select: { outletId: true } })
      : null;
    const outletId = terminal?.outletId;
    const sessions = outletId
      ? await prisma.posSession.findMany({
          where: { propertyId, outletId },
          orderBy: { updatedAt: 'desc' },
          take: 12,
          select: {
            id: true, outletId: true, deviceId: true, businessDate: true,
            bankingModel: true, bankType: true, primaryOperatorId: true,
            status: true, controlStatus: true, approvalDecision: true,
            approvalNotes: true, reason: true, openingCash: true,
            expectedCash: true, actualCash: true, variance: true,
            openedBy: true, openedAt: true, closedAt: true, updatedAt: true,
          },
        })
      : [];

    return NextResponse.json({
      success: true,
      property,
      posSessions: sessions,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[sync/control-state] Error:', error);
    return NextResponse.json({ error: 'Unable to refresh terminal control state' }, { status: 500 });
  }
}
