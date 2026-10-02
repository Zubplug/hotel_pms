import { PrismaClient } from '@hotel-pms/db';

/**
 * Returns (and lazily creates) the inactive Staff actor required by the
 * accounting schema for Booking Engine payments.
 *
 * Follows the exact same pattern as the OTA system actor:
 *   email: booking.system+{organizationId}@lodgecore.internal
 *
 *
 * @param prisma  The base Prisma client (NOT a transaction client — this
 *                operation uses upsert and must run outside any outer tx).
 */
export async function getOrCreateBookingSystemActor(
  prisma: PrismaClient,
  organizationId: string
): Promise<string> {
  const email = `booking.system+${organizationId}@lodgecore.internal`;

  const existing = await prisma.staff.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.staff.create({
    data: {
      organizationId,
      email,
      firstName: 'Booking',
      lastName: 'System',
      department: 'SYSTEM',
      position: 'BOOKING_ENGINE_SYSTEM_ACTOR',
      propertyAccess: [],
      isActive: false,
    },
    select: { id: true },
  });

  return created.id;
}

