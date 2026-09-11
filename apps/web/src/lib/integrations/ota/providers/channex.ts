import { NextRequest } from 'next/server';
import { ChannelManagerAdapter } from '../ChannelManagerAdapter';
import { AvailabilitySnapshot, OtaPaymentInfo, ParsedReservation, RateSnapshot, RemoteRatePlan, RemoteRoom, SyncResult } from '../types';
import crypto from 'crypto';

export class ChannexAdapter implements ChannelManagerAdapter {
  providerName = 'CHANNEX';

  async testConnection(credentialsRef: string): Promise<boolean> {
    throw new Error('NOT_IMPLEMENTED');
  }

  async fetchRemoteRooms(credentialsRef: string): Promise<RemoteRoom[]> {
    throw new Error('NOT_IMPLEMENTED');
  }

  async fetchRemoteRatePlans(credentialsRef: string): Promise<RemoteRatePlan[]> {
    throw new Error('NOT_IMPLEMENTED');
  }

  async verifyWebhookSignature(req: NextRequest, rawBody: string, secret?: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'development' && process.env.IGNORE_WEBHOOK_SIGNATURE === 'true') {
        return true;
    }
    
    if (!secret) return false;
    
    const signature = req.headers.get('x-channex-signature');
    if (!signature) return false;

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (sigBuffer.length !== expectedBuffer.length) {
        return false;
    }
    
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  parseWebhookReservation(rawPayload: any): ParsedReservation {
    const booking = rawPayload.booking || rawPayload;
    
    if (booking.rooms && booking.rooms.length > 1) {
        throw new Error('Unsupported multi-room reservation payload.');
    }

    const room = booking.rooms?.[0]; 

    if (!room) {
      throw new Error('Channex webhook missing room data');
    }

    let externalStatus: ParsedReservation['externalStatus'] = 'CONFIRMED';
    if (booking.status === 'cancelled') {
      externalStatus = 'CANCELLED';
    } else if (booking.status === 'modified' || booking.revision_id > 1) {
      externalStatus = 'MODIFIED';
    }

    const payment: OtaPaymentInfo = {
      method: 'UNKNOWN',
      status: 'UNKNOWN',
      externalReference: booking.payment_reference,
    };

    if (booking.payment_collect === 'hotel') {
      payment.method = 'PAY_AT_PROPERTY';
      payment.status = 'UNPAID';
    } else if (booking.payment_collect === 'channel') {
      payment.method = 'OTA_COLLECTED';
      payment.status = 'OTA_COLLECTED';
      payment.settlementStatus = 'PENDING'; 
    } else if (booking.vcc_details || booking.virtual_card) {
      payment.method = 'OTA_VIRTUAL_CARD';
      payment.status = 'PENDING_CHARGE';
    }

    return {
      externalReservationId: booking.booking_id || booking.id,
      externalRevision: booking.revision_id?.toString() || '1',
      provider: 'CHANNEX',
      externalStatus,
      checkIn: new Date(room.checkin_date),
      checkOut: new Date(room.checkout_date),
      adults: room.occupancy?.adults || 1,
      children: room.occupancy?.children || 0,
      externalRoomTypeId: room.room_type_id,
      externalRatePlanId: room.rate_plan_id,
      totalAmount: parseFloat(room.amount || booking.amount || '0'),
      currency: booking.currency || 'USD',
      guest: {
        firstName: booking.customer?.name || 'Unknown',
        lastName: booking.customer?.surname || 'Unknown',
        email: booking.customer?.mail,
        phone: booking.customer?.phone,
        country: booking.customer?.country,
      },
      specialRequests: booking.notes,
      payment,
      rawPayload,
    };
  }

  async pushAvailability(credentialsRef: string, externalPropertyId: string, inventory: AvailabilitySnapshot[]): Promise<SyncResult> {
    throw new Error('NOT_IMPLEMENTED');
  }

  async pushRates(credentialsRef: string, externalPropertyId: string, rates: RateSnapshot[]): Promise<SyncResult> {
    throw new Error('NOT_IMPLEMENTED');
  }
}
