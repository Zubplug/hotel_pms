import prisma from '@/lib/prisma';
import { ParsedReservation } from './types';
import { MappingResolver } from './resolver';
import { OTALogger } from './logger';
import { SharedReservationService } from '../services/reservation-service';

export const OTAReservationService = {
  async processReservation(organizationId: string, propertyId: string, parsed: ParsedReservation) {
    const { roomTypeId, ratePlanId } = await MappingResolver.resolveReservation(parsed, organizationId, propertyId);

    const systemUser = await prisma.user.findFirst({
        where: { email: 'system@ota.lodgecore.internal' }
    });
    const actorId = systemUser?.id || '00000000-0000-0000-0000-000000000000';

    // Transaction strictly for the OTA integration boundaries. SharedReservationService manages its own transaction natively.
    const result = await prisma.$transaction(async (tx: any) => {
        
        // 1. ATOMIC LOCKING: Lock the row if it exists. This absolutely prevents concurrent revision processing races.
        const lockedRows: any[] = await tx.$queryRaw`
            SELECT "id", "externalRevision", "lodgecoreReservationId", "externalStatus"
            FROM "ChannelReservation" 
            WHERE "channelConnectionId" = ${parsed.channelConnectionId}::uuid
              AND "externalReservationId" = ${parsed.externalReservationId}
            FOR UPDATE
        `;

        const existingChannelRes = lockedRows.length > 0 ? lockedRows[0] : null;

        if (existingChannelRes) {
            // 2. ATOMIC REVISION CHECK
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

            // Advance the revision atomically
            await tx.channelReservation.update({
                where: { id: existingChannelRes.id },
                data: { 
                    externalRevision: parsed.externalRevision,
                    externalStatus: parsed.externalStatus,
                    modifiedAt: new Date()
                }
            });

            if (!existingChannelRes.lodgecoreReservationId) {
                throw new Error('ChannelReservation exists but lodgecoreReservationId is null. Cannot modify.');
            }

            if (parsed.externalStatus === 'CANCELLED' && existingChannelRes.externalStatus !== 'CANCELLED') {
                await SharedReservationService.cancelReservation(existingChannelRes.lodgecoreReservationId, {
                    createdBy: actorId,
                    organizationId,
                    userAgent: 'OTA_CHANNEX'
                });
                return { success: true };
            }

            if (parsed.externalStatus === 'MODIFIED' || parsed.externalStatus === 'CONFIRMED') {
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
                    userAgent: 'OTA_CHANNEX'
                });
                return { success: true };
            }
            
            return { success: true };
        }

        if (parsed.externalStatus === 'CANCELLED') {
            return { success: true, ignored: true, reason: 'cancel_non_existent' };
        }

        // 3. CREATE NATIVE RESERVATION
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
            roomId: null, // Room Type inventory consumed, physical room unassigned
            adults: parsed.adults,
            children: parsed.children,
            ratePlanId,
            overrideTotalAmount: parsed.totalAmount,
            currency: parsed.currency,
            source: parsed.provider,
            status: 'CONFIRMED',
            confirmationNumber: parsed.externalReservationId,
            specialRequests: parsed.specialRequests,
            createdBy: actorId,
            userEmail: 'system@ota.lodgecore.internal',
            userRole: 'SYSTEM_OTA',
            userAgent: 'OTA_CHANNEX'
        });

        // 4. Create the ChannelReservation link.
        // If Worker B races here, the composite unique constraint (channelConnectionId_externalReservationId) 
        // will throw Prisma P2002. QStash retry will then hit the FOR UPDATE lock next time! Perfect idempotency.
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
    });
    
    return result;
  }
};
