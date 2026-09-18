import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';

/**
 * GET /api/v1/guests/credits?propertyId=xxx
 *
 * Returns all guests with available guest credit for the given property.
 * Available credit = REFUND_OWED entry amount - SUM(allocations.amount)
 * Only guests with net available > 0 are returned.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);

    await assertPropertyAccess(session.user.id, propertyId);

    // Fetch all open REFUND_OWED entries for this property
    const entries = await prisma.cityLedgerEntry.findMany({
      where: {
        propertyId,
        type: 'REFUND_OWED',
        status: 'OPEN'
      },
      include: {
        guest: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true }
        },
        allocations: {
          select: { id: true, amount: true, folioId: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    if (entries.length === 0) return successResponse([]);

    // Group by guest, compute available
    const byGuest = new Map<string, {
      guestId: string;
      guestName: string;
      guestPhone: string;
      guestEmail: string;
      availableAmount: number;
      currency: string;
      lastActivityAt: Date;
      creditEntryIds: string[];
    }>();

    for (const entry of entries) {
      const guestId = entry.guestId ?? '';
      if (!guestId) continue;

      const allocated = entry.allocations.reduce((s: number, a: any) => s + Number(a.amount), 0);
      const available = Number(entry.amount) - allocated;

      if (available <= 0.01) continue;

      if (!byGuest.has(guestId)) {
        byGuest.set(guestId, {
          guestId,
          guestName: entry.guest ? `${entry.guest.firstName} ${entry.guest.lastName}`.trim() : 'Unknown Guest',
          guestPhone: entry.guest?.phone ?? '',
          guestEmail: entry.guest?.email ?? '',
          availableAmount: 0,
          currency: entry.currency,
          lastActivityAt: entry.createdAt,
          creditEntryIds: []
        });
      }

      const rec = byGuest.get(guestId)!;
      rec.availableAmount += available;
      if (entry.createdAt > rec.lastActivityAt) rec.lastActivityAt = entry.createdAt;
      rec.creditEntryIds.push(entry.id);
    }

    return successResponse(Array.from(byGuest.values()));
  } catch (err: unknown) {
    console.error('[GET /guests/credits]', err);
    return errorResponse('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500);
  }
}
