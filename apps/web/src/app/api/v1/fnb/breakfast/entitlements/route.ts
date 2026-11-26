import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

// Returns the audited breakfast entitlement list for the current business
// date. The list is printable but does not mutate/redemption-post anything.
export async function GET() {
  try {
    const session = await auth();
    const userId = (session?.user as any)?.id;
    const propertyId = (session?.user as any)?.propertyId;
    if (!userId || !propertyId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const organization = await requireOrganizationContext(userId);
    if (!organization.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Property access denied' }, { status: 403 });

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { name: true, businessDate: true, breakfastEligibilitySnapshotDate: true },
    });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (!property.businessDate) {
      return NextResponse.json({
        data: {
          available: false,
          reason: 'The property business date is not configured yet.',
          businessDate: null,
          auditedBusinessDate: null,
          rows: [],
        },
      });
    }

    const businessDate = new Date(property.businessDate);
    const snapshotDate = property.breakfastEligibilitySnapshotDate
      ? new Date(property.breakfastEligibilitySnapshotDate)
      : null;
    if (!snapshotDate || dateKey(snapshotDate) !== dateKey(businessDate)) {
      return NextResponse.json({
        data: {
          available: false,
          reason: 'Night Audit has not completed the breakfast eligibility snapshot for the current business date.',
          businessDate: dateKey(businessDate),
          auditedBusinessDate: null,
          rows: [],
        },
      });
    }

    const snapshots = await prisma.breakfastEligibilitySnapshot.findMany({
      where: { propertyId, redeemableBusinessDate: businessDate, status: 'ELIGIBLE' },
      orderBy: [{ roomNumber: 'asc' }, { guestName: 'asc' }],
    });
    const redemptions = await prisma.breakfastRedemption.findMany({
      where: { propertyId, businessDate: businessDate },
      select: { reservationId: true, coversRedeemed: true },
    });
    const redeemedByReservation = new Map<string, number>();
    for (const redemption of redemptions) {
      redeemedByReservation.set(
        redemption.reservationId,
        (redeemedByReservation.get(redemption.reservationId) || 0) + redemption.coversRedeemed,
      );
    }

    const rows = snapshots.map((snapshot) => {
      const coversRedeemed = redeemedByReservation.get(snapshot.reservationId) || 0;
      const remainingCovers = Math.max(0, snapshot.maxCoversAllowed - coversRedeemed);
      return {
        reservationId: snapshot.reservationId,
        roomNumber: snapshot.roomNumber,
        guestName: snapshot.guestName,
        maxCoversAllowed: snapshot.maxCoversAllowed,
        coversRedeemed,
        remainingCovers,
      };
    }).filter((row) => row.remainingCovers > 0);

    return NextResponse.json({
      data: {
        available: true,
        propertyId,
        propertyName: property.name,
        businessDate: dateKey(businessDate),
        auditedBusinessDate: snapshots[0] ? dateKey(snapshots[0].businessDate) : null,
        rows,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/v1/fnb/breakfast/entitlements]', error);
    return NextResponse.json({ error: 'Unable to load breakfast entitlements' }, { status: 500 });
  }
}
