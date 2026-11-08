import prisma from '@hotel-pms/db';

type SessionLookupDb = Pick<typeof prisma, 'frontdeskSession'>;

/**
 * A check-in bypass is an exception record, not a cash transaction. It may
 * therefore be recorded against the operator's just-closed shift when a
 * guest was left pending at shift handover. The shift itself remains locked.
 * Finalized/reconciled shifts are deliberately excluded.
 */
export async function findCheckInBypassSession(
  db: SessionLookupDb,
  propertyId: string,
  staffId: string,
  businessDate?: Date,
) {
  const openSession = await db.frontdeskSession.findFirst({
    where: { propertyId, staffId, status: 'OPEN', controlStatus: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
  if (openSession) return { session: openSession, recovery: false };

  // Never guess across business dates. A missing date means the caller must
  // supply a fresh/open shift rather than reusing an old closed one.
  const closedSession = businessDate ? await db.frontdeskSession.findFirst({
    where: {
      propertyId,
      staffId,
      ...(businessDate ? { businessDate } : {}),
      status: 'CLOSED',
      controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] },
    },
    orderBy: { closedAt: 'desc' },
  }) : null;

  return closedSession
    ? { session: closedSession, recovery: true }
    : { session: null, recovery: false };
}
