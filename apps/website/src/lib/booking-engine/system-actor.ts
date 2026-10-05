import { PrismaClient } from '@hotel-pms/db';
import crypto from 'crypto';

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

/** User identity required by the native RefundRequest relation. */
export async function getOrCreateBookingSystemUser(
  prisma: PrismaClient,
  organizationId: string
): Promise<string> {
  const email = `booking.system+${organizationId}@lodgecore.internal`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: `SYSTEM_ONLY:${crypto.randomBytes(32).toString('hex')}`,
      isLodgeCoreAdmin: false,
      membership: {
        create: { organizationId, role: 'SYSTEM', status: 'ACTIVE', permissions: [] },
      },
    },
    select: { id: true },
  });
  const membership = await prisma.organizationMembership.findUnique({ where: { userId: user.id } });
  if (!membership || membership.organizationId !== organizationId) {
    throw new Error(`Booking system user is not assigned to organisation ${organizationId}`);
  }
  return user.id;
}
