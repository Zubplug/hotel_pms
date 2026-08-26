import prisma from '@hotel-pms/db';

export async function findActiveFrontdeskSession(userId: string, propertyId: string, sessionId?: string | null) {
  const staff = await prisma.staff.findFirst({ where: { userId }, select: { id: true } });
  if (!staff) return { staff: null, session: null };

  const session = await prisma.frontdeskSession.findFirst({
    where: {
      ...(sessionId ? { id: sessionId } : {}),
      propertyId,
      staffId: staff.id,
      status: 'OPEN'
    },
    select: { id: true, propertyId: true, staffId: true, cashAccountId: true, businessDate: true, status: true }
  });
  return { staff, session };
}

export function isFrontdeskCashierRole(role: unknown) {
  return ['RECEPTIONIST', 'FRONT_DESK', 'FRONT_DESK_MANAGER', 'CASHIER'].includes(String(role || '').toUpperCase());
}
