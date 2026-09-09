import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

async function main() {
  const requestedLimit = Number(process.env.FRONTDESK_DISCOUNT_REPAIR_LIMIT || 0);
  const events = await prisma.hotelEvent.findMany({
    where: {
      eventType: 'DISCOUNT_REQUESTED',
      aggregateType: 'RESERVATION_ROOM',
    },
    orderBy: { occurredAt: 'desc' },
    ...(requestedLimit > 0 ? { take: requestedLimit } : {}),
  });

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const event of events) {
    const payload = (event.payload || {}) as Record<string, any>;
    const reservationRoomId = payload.reservationRoomId || event.aggregateId;
    const requestedBy = isUuid(event.operatorId)
      ? event.operatorId
      : isUuid(event.deviceId)
        ? event.deviceId
        : null;

    if (!requestedBy) {
      console.warn(`Skipping ${event.idempotencyKey}: no UUID requester`);
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const room = await tx.reservationRoom.findUnique({
        where: { id: reservationRoomId },
        include: { reservation: true },
      });

      if (room && room.reservation.propertyId !== event.propertyId) {
        throw new Error(`Property mismatch for reservation room ${reservationRoomId}`);
      }

      const approval = await tx.approvalRequest.upsert({
        where: { idempotencyKey: `offline_discount:${event.idempotencyKey}` },
        create: {
          propertyId: event.propertyId,
          type: 'DISCOUNT',
          status: 'PENDING',
          executionStatus: 'NOT_APPLIED',
          requestedBy,
          amount: Number(payload.discountAmount || payload.amount || 0),
          currency: room?.currency || payload.currency || 'NGN',
          reason: payload.reason || 'Offline room discount request',
          details: {
            ...payload,
            reservationRoomId,
            dependencyStatus: room ? 'READY' : 'WAITING_FOR_RESERVATION_ROOM',
          },
          snapshot: {
            ...payload,
            targetType: 'RESERVATION_ROOM',
            reservationRoomId,
            originalRate: room ? Number(room.rateAmount) : null,
          },
          idempotencyKey: `offline_discount:${event.idempotencyKey}`,
        },
        update: {},
      });

      if (room && !room.discountApprovalId) {
        await tx.reservationRoom.update({
          where: { id: room.id },
          data: { discountApprovalId: `PENDING:${approval.id}` },
        });
        linked++;
      }

      if (approval.createdAt.getTime() === approval.updatedAt.getTime()) created++;
    });
  }

  console.log(JSON.stringify({ scanned: events.length, created, linked, skipped }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
