type HousekeepingDb = {
  housekeepingTask: any;
};

type CheckoutTaskInput = {
  reservationId: string;
  propertyId: string;
  roomId: string;
  priority: string;
  businessDate: Date;
  notes?: string | null;
};

/**
 * There can only be one open checkout/stayover housekeeping task per room.
 * Checkout takes precedence and promotes an open stayover task when present.
 */
export async function upsertCheckoutHousekeepingTask(
  tx: HousekeepingDb,
  input: CheckoutTaskInput,
) {
  const idempotencyKey = `CHECKOUT_${input.reservationId}_${input.roomId}`;
  const existing = await tx.housekeepingTask.findFirst({
    where: {
      propertyId: input.propertyId,
      roomId: input.roomId,
      type: { in: ['STAYOVER', 'CHECKOUT'] },
      status: { notIn: ['INSPECTED', 'CANCELLED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return {
      task: await tx.housekeepingTask.update({
        where: { id: existing.id },
        data: {
          idempotencyKey,
          type: 'CHECKOUT',
          priority: input.priority,
          status: 'CLEANING',
          startedAt: new Date(),
          businessDate: input.businessDate,
          notes: input.notes ?? null,
        },
      }),
      created: false,
    };
  }

  return {
    task: await tx.housekeepingTask.upsert({
      where: { idempotencyKey },
      update: {
        type: 'CHECKOUT',
        priority: input.priority,
        status: 'CLEANING',
        startedAt: new Date(),
        businessDate: input.businessDate,
        notes: input.notes ?? null,
      },
      create: {
        idempotencyKey,
        propertyId: input.propertyId,
        roomId: input.roomId,
        type: 'CHECKOUT',
        priority: input.priority,
        status: 'CLEANING',
        startedAt: new Date(),
        businessDate: input.businessDate,
        notes: input.notes ?? null,
      },
    }),
    created: true,
  };
}
