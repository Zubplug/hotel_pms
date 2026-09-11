import prisma from '@hotel-pms/db';
import { ParsedReservation } from './types';

export const MappingResolver = {
  /**
   * Resolves an OTA ParsedReservation's external room and rate IDs to internal LodgeCore DB UUIDs.
   * Strictly enforces Tenant/Property isolation and Mapping Active Status.
   */
  async resolveReservation(parsed: ParsedReservation, organizationId: string, propertyId: string): Promise<{ roomTypeId: string, ratePlanId: string }> {
    if (!parsed.channelConnectionId) {
      throw new Error('channelConnectionId is required to resolve mappings.');
    }

    // 1. Fetch the ChannelConnection to verify ownership
    const connection = await prisma.channelConnection.findUnique({
      where: { id: parsed.channelConnectionId },
      include: { property: true }
    });

    if (!connection || connection.status === 'DISCONNECTED') {
      throw new Error('ChannelConnection not found or inactive.');
    }

    if (connection.property.organizationId !== organizationId) {
      throw new Error('ChannelConnection does not belong to the requested organization.');
    }

    if (connection.propertyId !== propertyId) {
      throw new Error('ChannelConnection does not belong to the requested property.');
    }

    // 2. Fetch mappings
    const [roomMapping, rateMapping] = await Promise.all([
      prisma.channelRoomMapping.findUnique({
        where: {
          channelConnectionId_externalRoomTypeId: {
            channelConnectionId: parsed.channelConnectionId,
            externalRoomTypeId: parsed.externalRoomTypeId,
          }
        },
      }),
      prisma.channelRatePlanMapping.findUnique({
        where: {
          channelConnectionId_externalRatePlanId: {
            channelConnectionId: parsed.channelConnectionId,
            externalRatePlanId: parsed.externalRatePlanId,
          }
        },
      })
    ]);

    if (!roomMapping || !roomMapping.isActive) {
      throw new Error(`Unmapped or inactive external Room Type ID: ${parsed.externalRoomTypeId}`);
    }

    if (!rateMapping || !rateMapping.isActive) {
      throw new Error(`Unmapped or inactive external Rate Plan ID: ${parsed.externalRatePlanId}`);
    }

    const [roomType, ratePlan] = await Promise.all([
      prisma.roomType.findUnique({ where: { id: roomMapping.lodgecoreRoomTypeId } }),
      prisma.ratePlan.findUnique({ where: { id: rateMapping.lodgecoreRatePlanId } }),
    ]);

    if (!roomType || roomType.propertyId !== propertyId) {
       throw new Error('Mapped RoomType does not belong to the requested property.');
    }

    if (!ratePlan || ratePlan.propertyId !== propertyId) {
       throw new Error('Mapped RatePlan does not belong to the requested property.');
    }

    return {
      roomTypeId: roomMapping.lodgecoreRoomTypeId,
      ratePlanId: rateMapping.lodgecoreRatePlanId,
    };
  }
};
