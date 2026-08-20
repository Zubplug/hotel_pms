import prisma from '@hotel-pms/db';
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Redis Publisher (used to notify the WebSocket Gateway about new commands)
// ---------------------------------------------------------------------------
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    redis.on('error', (err) => console.error('[LockOrchestrator] Redis error:', err));
  }
  return redis;
}

// ---------------------------------------------------------------------------
// Credential types
// ---------------------------------------------------------------------------
export type CredentialType = 'PRIMARY' | 'ADDITIONAL';

export interface IssueCredentialParams {
  reservationId: string;
  guestId?: string;
  roomId: string;
  lockId: string;
  propertyId: string;
  type: CredentialType;
  validFrom: Date;
  validUntil: Date;
  /** Caller-supplied idempotency key. Defaults to CHECKIN:{reservationId}:{guestId} for PRIMARY cards. */
  idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// Lock Orchestrator
// ---------------------------------------------------------------------------
export const lockOrchestrator = {
  /**
   * High-level helper called by the Check-In API route.
   * Looks up the first assigned room + lock, then calls issueCredential().
   */
  async generateCredentialForCheckIn(reservationId: string, propertyId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationRooms: {
          where: { status: 'ACTIVE' },
          include: { room: { include: { doorLocks: true } } },
        },
      },
    });

    if (!reservation) throw new Error('Reservation not found');

    const firstRoom = reservation.reservationRooms[0]?.room;
    if (!firstRoom) throw new Error('No active room assigned to this reservation');

    const doorLock = firstRoom.doorLocks[0];
    if (!doorLock) throw new Error(`No door lock configured for room ${firstRoom.number}`);

    return this.issueCredential({
      reservationId,
      guestId: reservation.primaryGuestId,
      roomId: firstRoom.id,
      lockId: doorLock.id,
      propertyId,
      type: 'PRIMARY',
      validFrom: new Date(),
      validUntil: new Date(reservation.checkOut),
    });
  },

  /**
   * Issues an additional (duplicate) key for an already-checked-in reservation.
   */
  async generateAdditionalCredential(reservationId: string, guestId: string | undefined, propertyId: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationRooms: {
          where: { status: 'ACTIVE' },
          include: { room: { include: { doorLocks: true } } },
        },
      },
    });

    if (!reservation) throw new Error('Reservation not found');
    if (reservation.status !== 'CHECKED_IN') throw new Error('Reservation must be CHECKED_IN to issue additional keys');

    const firstRoom = reservation.reservationRooms[0]?.room;
    if (!firstRoom) throw new Error('No active room assigned to this reservation');

    const doorLock = firstRoom.doorLocks[0];
    if (!doorLock) throw new Error(`No door lock configured for room ${firstRoom.number}`);

    // Build a unique idempotency key for additional keys including a timestamp
    // so each additional key request is treated as distinct
    const idempotencyKey = `ADDITIONAL_KEY:${reservationId}:${guestId ?? 'unknown'}:${Date.now()}`;

    return this.issueCredential({
      reservationId,
      guestId,
      roomId: firstRoom.id,
      lockId: doorLock.id,
      propertyId,
      type: 'ADDITIONAL',
      validFrom: new Date(),
      validUntil: new Date(reservation.checkOut),
      idempotencyKey,
    });
  },

  /**
   * Core method: creates a LockCredential, LockOperation, and LockCommand atomically.
   * Idempotent: if an operation with the same key exists, returns the existing one.
   */
  async issueCredential(params: IssueCredentialParams) {
    const {
      reservationId, guestId, roomId, lockId, propertyId,
      type, validFrom, validUntil,
    } = params;

    const idempotencyKey = params.idempotencyKey
      ?? `CHECKIN:${reservationId}:${guestId ?? 'primary'}`;

    // Idempotency guard: return existing operation if key already exists
    const existing = await prisma.lockOperation.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      console.log(`[Orchestrator] Returning existing operation ${existing.id} for idempotency key ${idempotencyKey}`);
      return existing;
    }

    // Find the active HardwareAgent for this property
    const agent = await prisma.hardwareAgent.findFirst({
      where: { propertyId, enabled: true },
      orderBy: { lastHeartbeat: 'desc' },
    });

    if (!agent) throw new Error(`No hardware agent configured for property ${propertyId}`);

    // Fetch the property to determine the provider
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });
    
    if (!property) throw new Error('Property not found');
    
    const lockConfig = property.lockConfiguration as { provider?: string } | null;
    const providerType = lockConfig?.provider ?? 'DELUNS';

    let operation;
    
    // Dispatch to the correct provider
    if (providerType === 'DELUNS') {
      const { delunsLockProvider } = await import('./providers/deluns');
      operation = await delunsLockProvider.issueCredential({
        ...params,
        idempotencyKey,
      }, agent.id);
    } else {
      throw new Error(`Unsupported or missing lock provider: ${providerType}`);
    }

    // Publish to Redis to notify the WebSocket Gateway
    try {
      const pubClient = getRedis();
      await pubClient.publish(
        `gateway:commands:${propertyId}`,
        JSON.stringify({ type: 'COMMAND_DISPATCH', commandId: operation.commandId, agentId: agent.id }),
      );
    } catch (redisErr) {
      // Redis is a transport hint only — don't fail the whole operation
      console.warn('[Orchestrator] Redis publish failed (agent will poll on reconnect):', redisErr);
    }

    return operation;
  },

  /**
   * Queues revocation for all active credentials on a reservation.
   * Called during checkout. Does NOT block checkout on USB encoder availability.
   */
  async revokeReservationCredentials(reservationId: string, propertyId: string): Promise<number> {
    const credentials = await prisma.lockCredential.findMany({
      where: { reservationId, status: 'ACTIVE' },
      include: { lock: true, room: true },
    });

    if (credentials.length === 0) return 0;

    const agent = await prisma.hardwareAgent.findFirst({
      where: { propertyId, enabled: true },
      orderBy: { lastHeartbeat: 'desc' },
    });

    if (!agent) {
      console.warn(`[Orchestrator] No agent found for property ${propertyId}; credentials marked REVOCATION_PENDING`);
      await prisma.lockCredential.updateMany({
        where: { reservationId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), metadata: { revocationNote: 'REVOCATION_PENDING_NO_AGENT' } },
      });
      return credentials.length;
    }

    let count = 0;
    for (const cred of credentials) {
      const idempotencyKey = `REVOKE:${cred.id}`;
      const existing = await prisma.lockOperation.findUnique({ where: { idempotencyKey } });
      if (existing) continue; // already queued

      await prisma.$transaction(async (tx: any) => {
        const op = await tx.lockOperation.create({
          data: {
            idempotencyKey,
            propertyId,
            lockId: cred.lockId,
            roomId: cred.roomId,
            reservationId,
            credentialId: cred.id,
            agentId: agent.id,
            operation: 'REVOKE_CREDENTIAL',
            status: 'QUEUED',
          },
        });

        await tx.lockCommand.create({
          data: {
            operationId: op.id,
            agentId: agent.id,
            commandType: 'REVOKE_CARD',
            status: 'QUEUED',
            payload: { operationId: op.id, credentialId: cred.id, reservationId },
          },
        });

        // Mark credential as pending revocation
        await tx.lockCredential.update({
          where: { id: cred.id },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });
      });

      count++;
    }

    // Notify gateway
    try {
      const pubClient = getRedis();
      await pubClient.publish(`gateway:commands:${propertyId}`, JSON.stringify({ type: 'REVOKE_DISPATCH', agentId: agent.id }));
    } catch (e) {
      console.warn('[Orchestrator] Redis publish failed for revocation:', e);
    }

    return count;
  },

  /**
   * Dispatches a READ_CARD command to the hardware agent for a property.
   */
  async readCard(propertyId: string, userId: string) {
    const agent = await prisma.hardwareAgent.findFirst({
      where: { propertyId, enabled: true },
      orderBy: { lastHeartbeat: 'desc' },
    });

    if (!agent) throw new Error(`No hardware agent configured for property ${propertyId}`);

    const idempotencyKey = `READ_CARD:${propertyId}:${Date.now()}`;

    // ✅ Commit DB records first, then notify Redis OUTSIDE the transaction.
    // Putting Redis inside a Prisma interactive transaction holds the DB connection
    // open while awaiting network I/O, easily blowing the 5s default timeout.
    const op = await prisma.$transaction(async (tx: any) => {
      const newOp = await tx.lockOperation.create({
        data: {
          idempotencyKey,
          propertyId,
          agentId: agent.id,
          operation: 'READ_CARD',
          status: 'QUEUED',
        },
      });

      const command = await tx.lockCommand.create({
        data: {
          operationId: newOp.id,
          agentId: agent.id,
          commandType: 'READ_CARD',
          status: 'QUEUED',
          payload: { operationId: newOp.id },
        },
      });

      await tx.lockOperation.update({
        where: { id: newOp.id },
        data: { commandId: command.id },
      });

      return { op: newOp, commandId: command.id };
    });

    // Notify gateway AFTER transaction commits
    try {
      const pubClient = getRedis();
      await pubClient.publish(
        `gateway:commands:${propertyId}`,
        JSON.stringify({ type: 'COMMAND_DISPATCH', commandId: op.commandId, agentId: agent.id })
      );
    } catch (e) {
      console.warn('[Orchestrator] Redis publish failed for READ_CARD (agent will poll):', e);
    }

    return op.op;
  },

  /**
   * Dispatches a CANCEL_CARD command to the hardware agent to physically erase a card on the encoder.
   */
  async cancelCard(propertyId: string, userId: string) {
    const agent = await prisma.hardwareAgent.findFirst({
      where: { propertyId, enabled: true },
      orderBy: { lastHeartbeat: 'desc' },
    });

    if (!agent) throw new Error(`No hardware agent configured for property ${propertyId}`);

    const idempotencyKey = `CANCEL_CARD:${propertyId}:${Date.now()}`;

    // ✅ Commit DB records first, then notify Redis OUTSIDE the transaction.
    const result = await prisma.$transaction(async (tx: any) => {
      const op = await tx.lockOperation.create({
        data: {
          idempotencyKey,
          propertyId,
          agentId: agent.id,
          operation: 'CANCEL_CARD',
          status: 'QUEUED',
        },
      });

      const command = await tx.lockCommand.create({
        data: {
          operationId: op.id,
          agentId: agent.id,
          commandType: 'CANCEL_CARD',
          status: 'QUEUED',
          payload: { operationId: op.id },
        },
      });

      await tx.lockOperation.update({
        where: { id: op.id },
        data: { commandId: command.id },
      });

      return { op, commandId: command.id };
    });

    // Notify gateway AFTER transaction commits
    try {
      const pubClient = getRedis();
      await pubClient.publish(
        `gateway:commands:${propertyId}`,
        JSON.stringify({ type: 'COMMAND_DISPATCH', commandId: result.commandId, agentId: agent.id })
      );
    } catch (e) {
      console.warn('[Orchestrator] Redis publish failed for CANCEL_CARD (agent will poll):', e);
    }

    return result.op;
  },
};
