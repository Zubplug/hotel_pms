import prisma from '@hotel-pms/db';
import { ParsedReservation } from './types';
import { MappingResolver } from './resolver';
import { OTALogger } from './logger';
import { SharedReservationService } from '../../services/reservation-service';
import crypto from 'crypto';

// Sentinel thrown when pg_try_advisory_xact_lock returns false.
// The outbox worker treats this as a transient error and retries.
export class LockContentionError extends Error {
  readonly retryable = true;
  constructor() {
    super('OTA_LOCK_CONTENTION: another worker is processing this reservation, will retry');
    this.name = 'LockContentionError';
  }
}

/**
 * Derive a stable pair of 32-bit ints from (channelConnectionId, externalReservationId).
 * Using two-argument pg_try_advisory_xact_lock(int4, int4) avoids cross-connection
 * collisions and sidesteps the bigint overload that Prisma sends by default.
 */
function advisoryLockKeys(channelConnectionId: string, externalReservationId: string): [number, number] {
  const h1 = crypto.createHash('md5').update(channelConnectionId).digest().readInt32BE(0);
  const h2 = crypto.createHash('md5').update(externalReservationId).digest().readInt32BE(0);
  return [h1, h2];
}

export const OTAReservationService = {
  async processReservation(
    organizationId: string,
    propertyId: string,
    parsed: ParsedReservation,
  ) {
    // ── Dry-run gate ────────────────────────────────────────────────────────
    if (process.env.OTA_RESERVATION_IMPORT !== 'true') {
      return { success: true, dryRun: true };
    }

    // ── Mapping (outside tx – read-only, no lock held) ───────────────────
    const { roomTypeId, ratePlanId } = await MappingResolver.resolveReservation(
      parsed,
      organizationId,
      propertyId,
    );

    // ── System actor (fail closed if not seeded) ─────────────────────────
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });
    const scopedSystemEmail = organization
      ? `system+${organization.slug}@lodgecore.internal`
      : null;
    const systemUser = await prisma.user.findFirst({
      where: {
        email: scopedSystemEmail ?? 'system@lodgecore.internal',
        membership: { organizationId },
      },
    }) ?? await prisma.user.findFirst({
      where: {
        email: 'system@lodgecore.internal',
        membership: { organizationId },
      },
    });
    if (!systemUser) {
      throw new Error(
        'System integration user not found or not authorised for this organisation. Run the seed migration.',
      );
    }
    const actorId = systemUser.id;

    // ── Fast idempotency pre-check (no lock needed) ───────────────────────
    // If the ChannelReservation already exists at >= the incoming revision,
    // we can short-circuit entirely before touching a transaction.
    const existingFast = await prisma.channelReservation.findFirst({
      where: {
        channelConnectionId: parsed.channelConnectionId!,
        externalReservationId: parsed.externalReservationId,
      },
      select: { id: true, externalRevision: true },
    });
    if (existingFast && parsed.externalRevision) {
      const incomingRev = parseInt(parsed.externalRevision, 10);
      const currentRev = parseInt(existingFast.externalRevision ?? '0', 10);
      if (!isNaN(incomingRev) && !isNaN(currentRev) && incomingRev <= currentRev) {
        OTALogger.info('OTA_RESERVATION_IGNORED', {
          message: `Pre-check: stale revision ${parsed.externalRevision}, current is ${currentRev}`,
        });
        return { success: true, ignored: true, reason: 'stale_revision' };
      }
    }

    // ── Single unified transaction ────────────────────────────────────────
    const [lockH1, lockH2] = advisoryLockKeys(
      parsed.channelConnectionId ?? '',
      parsed.externalReservationId,
    );

    const result = await prisma.$transaction(async (tx: any) => {
      // ── 1. NON-BLOCKING advisory lock ──────────────────────────────────
      // pg_try_advisory_xact_lock(int4, int4) returns TRUE if the lock was
      // acquired, FALSE if another session already holds it.
      // The lock is automatically released when this transaction ends.
      const lockRows: { locked: boolean }[] =
        await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${lockH1}::int4, ${lockH2}::int4) AS locked`;

      if (!lockRows[0]?.locked) {
        // Another worker is inside this exact critical section right now.
        // Throw LockContentionError so the caller (outbox worker) retries
        // after a short backoff. Do NOT create any data.
        throw new LockContentionError();
      }

      // ── 2. FOR UPDATE row lock (prevents double-write after first commit) ─
      const lockedRows: any[] = await tx.$queryRaw`
        SELECT "id", "externalRevision", "lodgecoreReservationId", "externalStatus"
        FROM   "ChannelReservation"
        WHERE  "channelConnectionId"    = ${parsed.channelConnectionId}::uuid
          AND  "externalReservationId"  = ${parsed.externalReservationId}
        FOR UPDATE
      `;
      const existingChannelRes = lockedRows[0] ?? null;

      // ── 3. Revision gate (inside lock, authoritative) ──────────────────
      if (existingChannelRes) {
        if (parsed.externalRevision && existingChannelRes.externalRevision) {
          const incomingRev = parseInt(parsed.externalRevision, 10);
          const currentRev  = parseInt(existingChannelRes.externalRevision, 10);
          if (!isNaN(incomingRev) && !isNaN(currentRev) && incomingRev <= currentRev) {
            OTALogger.info('OTA_RESERVATION_IGNORED', {
              message: `Locked check: stale revision ${parsed.externalRevision}, current is ${currentRev}`,
            });
            return { success: true, ignored: true, reason: 'stale_revision' };
          }
        }

        if (!existingChannelRes.lodgecoreReservationId) {
          throw new Error('ChannelReservation exists but lodgecoreReservationId is null. Cannot modify.');
        }

        // ── 4a. MODIFY or CANCEL ──────────────────────────────────────────
        if (parsed.externalStatus === 'CANCELLED' && existingChannelRes.externalStatus !== 'CANCELLED') {
          await SharedReservationService.cancelReservation(
            existingChannelRes.lodgecoreReservationId,
            { createdBy: actorId, organizationId, userAgent: 'OTA_CHANNEX', tx },
          );
        } else if (parsed.externalStatus === 'MODIFIED' || parsed.externalStatus === 'CONFIRMED') {
          await SharedReservationService.modifyReservation(
            existingChannelRes.lodgecoreReservationId,
            {
              checkIn:             parsed.checkIn,
              checkOut:            parsed.checkOut,
              adults:              parsed.adults,
              children:            parsed.children,
              roomTypeId,
              overrideTotalAmount: parsed.totalAmount,
              status:              parsed.externalStatus === 'CONFIRMED' ? 'CONFIRMED' : undefined,
              createdBy:           actorId,
              organizationId,
              userAgent:           'OTA_CHANNEX',
              tx,
            },
          );
        }

        // Advance revision AFTER native modification succeeds (still inside tx).
        await tx.channelReservation.update({
          where: { id: existingChannelRes.id },
          data: {
            externalRevision: parsed.externalRevision,
            externalStatus:   parsed.externalStatus,
            modifiedAt:       new Date(),
          },
        });

        return { success: true };
      }

      // ── 4b. CANCEL for non-existent reservation ────────────────────────
      if (parsed.externalStatus === 'CANCELLED') {
        return { success: true, ignored: true, reason: 'cancel_non_existent' };
      }

      // ── 4c. CREATE native reservation ─────────────────────────────────
      const nativeRes = await SharedReservationService.createReservation({
        propertyId,
        organizationId,
        guestDetails: {
          firstName: parsed.guest.firstName,
          lastName:  parsed.guest.lastName,
          email:     parsed.guest.email,
          phone:     parsed.guest.phone,
          country:   parsed.guest.country,
        },
        checkIn:             parsed.checkIn,
        checkOut:            parsed.checkOut,
        roomTypeId,
        roomId:              null,   // OTA reservations are unassigned; staff assign later
        adults:              parsed.adults,
        children:            parsed.children,
        ratePlanId,
        overrideTotalAmount: parsed.totalAmount,
        currency:            parsed.currency,
        source:              'OTA',
        status:              'CONFIRMED',
        confirmationNumber:  parsed.externalReservationId,
        specialRequests:     parsed.specialRequests,
        createdBy:           actorId,
        userEmail:           'system@lodgecore.internal',
        userRole:            'SYSTEM_OTA',
        userAgent:           'OTA_CHANNEX',
        tx,
      });

      // OTA prepaid / VCC metadata — store as internal notes only.
      // Never create a LodgeCore payment record for OTA-managed money.
      if (parsed.payment && parsed.payment.method !== 'PAY_AT_PROPERTY') {
        await tx.reservation.update({
          where: { id: nativeRes.id },
          data: {
            internalNotes: [
              `[OTA Payment]`,
              `Method: ${parsed.payment.method}`,
              `Status: ${parsed.payment.status}`,
              `Amount: ${parsed.totalAmount} ${parsed.currency}`,
              `Ref: ${parsed.payment.externalReference ?? 'N/A'}`,
            ].join(' | '),
          },
        });
      }

      // ── 5. Link ChannelReservation (inside same tx) ────────────────────
      await tx.channelReservation.create({
        data: {
          channelConnectionId:  parsed.channelConnectionId!,
          externalReservationId: parsed.externalReservationId,
          provider:             parsed.provider,
          lodgecoreReservationId: nativeRes.id,
          externalStatus:       'CONFIRMED',
          externalRevision:     parsed.externalRevision,
        },
      });

      return { success: true, dryRun: false };
    }, { timeout: 30000 }); // auto-releases advisory lock on COMMIT/ROLLBACK

    return result;
  },
};
