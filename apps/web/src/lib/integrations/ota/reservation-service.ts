import prisma from '@hotel-pms/db';
import { ParsedReservation } from './types';
import { MappingResolver } from './resolver';
import { OTALogger } from './logger';
import { SharedReservationService } from '../../services/reservation-service';
import crypto from 'crypto';

export const OTAReservationService = {
  async processReservation(organizationId: string, propertyId: string, parsed: ParsedReservation) {
    if (process.env.OTA_RESERVATION_IMPORT !== 'true') {
        return { success: true, dryRun: true };
    }

    const { roomTypeId, ratePlanId } = await MappingResolver.resolveReservation(parsed, organizationId, propertyId);

    const systemUser = await prisma.user.findFirst({
        where: {
            email: 'system@lodgecore.internal',
            membership: { organizationId }
        }
    });

    if (!systemUser) {
        throw new Error('System integration user not found or not authorized for this organization. Seed required.');
    }
    const actorId = systemUser.id;

    // Use Prisma's native timeout settings to allow some wait for advisory lock if needed
    const result = await prisma.$transaction(async (tx: any) => {
        
        // 1. ADVISORY LOCK: Solve the first-create race
        // We hash the externalReservationId into a 32-bit integer for Postgres advisory lock.
        const lockHash = crypto.createHash('md5').update(parsed.externalReservationId).digest().readInt32BE(0);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockHash})`;

        // 2. ATOMIC LOCKING: Lock the row if it exists.
        const lockedRows: any[] = await tx.$queryRaw`
            SELECT "id", "externalRevision", "lodgecoreReservationId", "externalStatus"
            FROM "ChannelReservation" 
            WHERE "channelConnectionId" = ${parsed.channelConnectionId}::uuid
              AND "externalReservationId" = ${parsed.externalReservationId}
            FOR UPDATE
        `;

        const existingChannelRes = lockedRows.length > 0 ? lockedRows[0] : null;

        if (existingChannelRes) {
            // 3. ATOMIC REVISION CHECK
            if (parsed.externalRevision && existingChannelRes.externalRevision) {
                const incomingRev = parseInt(parsed.externalRevision, 10);
                const currentRev = parseInt(existingChannelRes.externalRevision, 10);
                
                if (!isNaN(incomingRev) && !isNaN(currentRev) && incomingRev <= currentRev) {
                    OTALogger.info('OTA_RESERVATION_IGNORED', {
                        message: `Ignored stale or duplicate revision ${parsed.externalRevision}. Current is ${existingChannelRes.externalRevision}`
                    });
                    return { success: true, ignored: true, reason: 'stale_revision' };
                }
            }

            if (!existingChannelRes.lodgecoreReservationId) {
                throw new Error('ChannelReservation exists but lodgecoreReservationId is null. Cannot modify.');
            }

            if (parsed.externalStatus === 'CANCELLED' && existingChannelRes.externalStatus !== 'CANCELLED') {
                await SharedReservationService.cancelReservation(existingChannelRes.lodgecoreReservationId, {
                    createdBy: actorId,
                    organizationId,
                    userAgent: 'OTA_CHANNEX',
                    tx
                });
            } else if (parsed.externalStatus === 'MODIFIED' || parsed.externalStatus === 'CONFIRMED') {
                await SharedReservationService.modifyReservation(existingChannelRes.lodgecoreReservationId, {
                    checkIn: parsed.checkIn,
                    checkOut: parsed.checkOut,
                    adults: parsed.adults,
                    children: parsed.children,
                    roomTypeId: roomTypeId,
                    overrideTotalAmount: parsed.totalAmount,
                    status: parsed.externalStatus === 'MODIFIED' ? undefined : 'CONFIRMED',
                    createdBy: actorId,
                    organizationId,
                    userAgent: 'OTA_CHANNEX',
                    tx
                });
            }

            // Advance the revision atomically AFTER native modifications succeed!
            await tx.channelReservation.update({
                where: { id: existingChannelRes.id },
                data: {
                    externalRevision: parsed.externalRevision,
                    externalStatus: parsed.externalStatus,
                    modifiedAt: new Date()
                }
            });
            
            return { success: true };
        }

        if (parsed.externalStatus === 'CANCELLED') {
            return { success: true, ignored: true, reason: 'cancel_non_existent' };
        }

        // 4. CREATE NATIVE RESERVATION
        const nativeRes = await SharedReservationService.createReservation({
            propertyId,
            organizationId,
            guestDetails: {
                firstName: parsed.guest.firstName,
                lastName: parsed.guest.lastName,
                email: parsed.guest.email,
                phone: parsed.guest.phone,
                country: parsed.guest.country,
            },
            checkIn: parsed.checkIn,
            checkOut: parsed.checkOut,
            roomTypeId,
            roomId: null, // Unassigned physical room
            adults: parsed.adults,
            children: parsed.children,
            ratePlanId,
            overrideTotalAmount: parsed.totalAmount,
            currency: parsed.currency,
            source: 'OTA',
            status: 'CONFIRMED',
            confirmationNumber: parsed.externalReservationId,
            specialRequests: parsed.specialRequests,
            createdBy: actorId,
            userEmail: 'system@lodgecore.internal',
            userRole: 'SYSTEM_OTA',
            userAgent: 'OTA_CHANNEX',
            tx
        });

        // Add payment metadata notes if any
        if (parsed.payment && parsed.payment.method !== 'PAY_AT_PROPERTY') {
            await tx.reservation.update({
                where: { id: nativeRes.id },
                data: {
                    internalNotes: `[OTA Payment] Method: ${parsed.payment.method} | Status: ${parsed.payment.status} | Amount: ${parsed.totalAmount} ${parsed.currency} | Ref: ${parsed.payment.externalReference || 'N/A'}`
                }
            });
        }

        // 5. Create the ChannelReservation link
        await tx.channelReservation.create({
            data: {
                channelConnectionId: parsed.channelConnectionId!,
                externalReservationId: parsed.externalReservationId,
                provider: parsed.provider,
                lodgecoreReservationId: nativeRes.id,
                externalStatus: 'CONFIRMED',
                externalRevision: parsed.externalRevision
            }
        });

        return { success: true, dryRun: false };
    }, { timeout: 30000 }); // Large timeout for concurrency test queues
    
    return result;
  }
};
