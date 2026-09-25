import { NextRequest } from 'next/server';
import { ChannelManagerAdapter } from '../../ChannelManagerAdapter';
import {
  AvailabilitySnapshot,
  ParsedReservation,
  RateSnapshot,
  RatePlanSnapshot,
  RemoteRatePlan,
  RemoteRoom,
  SyncResult,
} from '../../types';
import { Beds24AccountApiScheduler } from './api-scheduler';
import { Beds24TokenManager } from './token-manager';

export class Beds24Adapter implements ChannelManagerAdapter {
  providerName = 'BEDS24';

  /**
   * Tests the connection using the encrypted refresh token.
   * Calls GET /properties (Beds24 API v2) to verify access.
   */
  async testConnection(credentialsRef: string): Promise<boolean> {
    try {
      // In Beds24 API v2, fetching the properties is a good way to test auth scopes.
      // We assume the token manager decrypts and the scheduler executes it safely.
      const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
      
      await Beds24AccountApiScheduler.execute(
        accountId, 
        credentialsRef, 
        '/properties'
      );
      
      return true;
    } catch (error) {
      console.error('Beds24 testConnection failed:', error);
      return false;
    }
  }

  // --- Phase 2: Discovery & Mapping ---
  // Granular Beds24-specific methods to fetch the hierarchy.

  async getProperties(credentialsRef: string, accountId: string) {
    return Beds24AccountApiScheduler.execute<any[]>(
      accountId,
      credentialsRef,
      '/properties'
    );
  }

  async getRooms(credentialsRef: string, accountId: string, propertyId: string) {
    // Rooms are often embedded in the property or fetched via /properties/rooms
    return Beds24AccountApiScheduler.execute<any[]>(
      accountId,
      credentialsRef,
      `/properties/${propertyId}/rooms`
    );
  }

  async getOffers(credentialsRef: string, accountId: string, roomId: string) {
    // In Beds24, rate plans are "Offers" or "Fixed Prices"
    return Beds24AccountApiScheduler.execute<any[]>(
      accountId,
      credentialsRef,
      `/inventory/rooms/offers?roomId=${roomId}`
    );
  }

  // Satisfy generic interface by composing the granular Beds24 methods
  async fetchRemoteRooms(credentialsRef: string): Promise<RemoteRoom[]> {
    const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
    // Note: Since the generic adapter doesn't pass externalPropertyId to fetchRemoteRooms,
    // we would typically fetch all properties or assume 1 property per connection.
    const properties = await this.getProperties(credentialsRef, accountId);
    if (!properties || properties.length === 0) return [];
    
    const rooms = await this.getRooms(credentialsRef, accountId, properties[0].id);
    return (rooms || []).map((r) => ({
      externalId: String(r.id),
      name: r.name,
      description: r.description,
    }));
  }

  async fetchRemoteRatePlans(credentialsRef: string): Promise<RemoteRatePlan[]> {
    const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
    const properties = await this.getProperties(credentialsRef, accountId);
    if (!properties || properties.length === 0) return [];
    
    const rooms = await this.getRooms(credentialsRef, accountId, properties[0].id);
    const ratePlans: RemoteRatePlan[] = [];
    
    for (const room of (rooms || [])) {
      const offers = await this.getOffers(credentialsRef, accountId, room.id);
      for (const offer of (offers || [])) {
        ratePlans.push({
          externalId: String(offer.id),
          name: offer.name || `Offer ${offer.id}`,
        });
      }
    }
    
    return ratePlans;
  }

  // --- Phase 4: Inbound Webhooks ---
  
  async verifyWebhookSignature(req: NextRequest, rawBody: string, secret?: string): Promise<boolean> {
    if (!secret) return false;
    
    // Beds24 can pass the secret via query string ?token=XYZ or inside the JSON payload.
    // Let's check both for robust compatibility.
    const urlToken = req.nextUrl.searchParams.get('token');
    if (urlToken === secret) {
      return true;
    }

    try {
      const json = JSON.parse(rawBody);
      if (json.secret === secret || json.token === secret) {
        return true;
      }
    } catch (e) {
      // Ignore JSON parse errors here
    }

    return false;
  }

  parseWebhookReservation(rawPayload: any): ParsedReservation {
    // Beds24 usually sends a lightweight webhook payload containing at least the bookId.
    // Full retrieval will happen in the Outbox processor via Beds24ReservationService.
    // For now, we extract what we can to satisfy the interface and queue the event.
    
    const bookId = rawPayload.bookId || rawPayload.id;
    if (!bookId) {
      throw new Error('Beds24 Webhook payload missing bookId');
    }

    const action = rawPayload.action?.toLowerCase() || 'modify';
    let externalStatus: 'CONFIRMED' | 'MODIFIED' | 'CANCELLED' = 'MODIFIED';
    
    if (action === 'cancel' || rawPayload.status === 'cancelled') {
      externalStatus = 'CANCELLED';
    } else if (action === 'new') {
      externalStatus = 'CONFIRMED';
    }

    // Webhooks are intentionally shallow.  Do not manufacture guest, date,
    // price, currency, or mapping values; the outbox worker must retrieve the
    // authoritative booking before LodgeCore processes it.
    return {
      externalReservationId: String(bookId),
      provider: 'BEDS24',
      externalStatus,
      isShallow: true,
      rawPayload,
    } as ParsedReservation;
  }

  async fetchFullReservation(credentialsRef: string, externalPropertyId: string, externalReservationId: string): Promise<ParsedReservation> {
    const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
    
    // In Beds24 API v2, fetch a specific booking
    const bookings = await Beds24AccountApiScheduler.execute<any[]>(
      accountId,
      credentialsRef,
      `/bookings?id=${externalReservationId}`
    );

    if (!bookings || bookings.length === 0) {
      throw new Error(`Booking ${externalReservationId} not found in Beds24`);
    }

    const b = bookings[0];

    let externalStatus: 'CONFIRMED' | 'MODIFIED' | 'CANCELLED' = 'CONFIRMED';
    if (b.status === 'cancelled' || b.status === '0') {
      externalStatus = 'CANCELLED';
    }

    // Mapping Beds24 API v2 booking structure to our ParsedReservation
    const currency = b.currency || b.currencyCode;
    if (!currency) throw new Error(`Beds24 booking ${b.id} has no currency`);
    if (!b.arrival || !b.departure || !b.roomId) {
      throw new Error(`Beds24 booking ${b.id} is missing arrival, departure, or room mapping`);
    }

    return {
      externalReservationId: String(b.id),
      externalRevision: String(new Date(b.modifyTime || b.bookTime).getTime()), // Safe revision timestamp
      provider: 'BEDS24',
      externalStatus,
      checkIn: new Date(b.arrival),
      checkOut: new Date(b.departure),
      adults: parseInt(b.numAdult || '1', 10),
      children: parseInt(b.numChild || '0', 10),
      externalRoomTypeId: String(b.roomId),
      externalRatePlanId: String(b.offerId),
      totalAmount: parseFloat(b.price || '0'),
      currency: String(currency),
      guest: {
        firstName: b.firstName || 'Unknown',
        lastName: b.lastName || 'Unknown',
        email: b.email,
        phone: b.phone,
        country: b.country,
      },
      payment: {
        method: b.stripeToken ? 'OTA_COLLECTED' : 'PAY_AT_PROPERTY', // Simplified guess
        status: b.paid > 0 ? 'PAID' : 'UNPAID',
        amount: b.paid,
      },
      rawPayload: b,
    };
  }

  // --- Phase 3: Outbound Sync ---
  
  async pushAvailability(
    credentialsRef: string,
    externalPropertyId: string, // Generally not needed directly if we pass roomId, but good for context
    inventory: AvailabilitySnapshot[]
  ): Promise<SyncResult> {
    try {
      const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
      
      // Group by roomId to optimize payload
      const payloadByRoom: Record<string, any[]> = {};
      
      for (const inv of inventory) {
        if (!payloadByRoom[inv.externalRoomTypeId]) {
          payloadByRoom[inv.externalRoomTypeId] = [];
        }
        
        // Format date to YYYY-MM-DD
        const dateStr = inv.date.toISOString().split('T')[0];
        
        payloadByRoom[inv.externalRoomTypeId].push({
          from: dateStr,
          to: dateStr,
          inventory: inv.availableRooms,
          // If restrictions exist, we push them into the room-level restrictions in Beds24
          ...(inv.restrictions && {
            restrictions: {
              closed: inv.restrictions.closed ? 1 : 0,
              closedToArrival: inv.restrictions.closedToArrival ? 1 : 0,
              closedToDeparture: inv.restrictions.closedToDeparture ? 1 : 0,
            }
          })
        });
      }
      
      const payload = Object.entries(payloadByRoom).map(([roomId, dates]) => ({
        roomId: parseInt(roomId, 10),
        calendar: dates
      }));

      await Beds24AccountApiScheduler.execute(
        accountId,
        credentialsRef,
        `/inventory/rooms/calendar`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      
      return { success: true };
    } catch (error: any) {
      console.error('Beds24 pushAvailability failed:', error);
      return { success: false, error: error.message };
    }
  }

  async pushRates(
    credentialsRef: string,
    externalPropertyId: string,
    rates: RateSnapshot[]
  ): Promise<SyncResult> {
    try {
      const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
      
      // Group by roomId
      const payloadByRoom: Record<string, any[]> = {};
      
      for (const rate of rates) {
        if (!payloadByRoom[rate.externalRoomTypeId]) {
          payloadByRoom[rate.externalRoomTypeId] = [];
        }
        
        const dateStr = rate.date.toISOString().split('T')[0];
        
        // In Beds24, rates/prices are updated per offer inside the calendar object
        payloadByRoom[rate.externalRoomTypeId].push({
          from: dateStr,
          to: dateStr,
          offers: [
            {
              offerId: parseInt(rate.externalRatePlanId, 10),
              price: rate.amount,
              minStay: rate.minStay,
              maxStay: rate.maxStay,
            }
          ]
        });
      }
      
      const payload = Object.entries(payloadByRoom).map(([roomId, dates]) => ({
        roomId: parseInt(roomId, 10),
        calendar: dates
      }));

      await Beds24AccountApiScheduler.execute(
        accountId,
        credentialsRef,
        `/inventory/rooms/calendar`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      
      return { success: true };
    } catch (error: any) {
      console.error('Beds24 pushRates failed:', error);
      return { success: false, error: error.message };
    }
  }

  async pushRestrictions(credentialsRef: string, externalPropertyId: string, restrictions: AvailabilitySnapshot[]): Promise<SyncResult> {
    return this.pushCalendar(credentialsRef, restrictions.map((item) => ({
      roomId: item.externalRoomTypeId,
      from: this.date(item.date),
      to: this.date(item.date),
      restrictions: {
        closed: item.restrictions?.closed ? 1 : 0,
        closedToArrival: item.restrictions?.closedToArrival ? 1 : 0,
        closedToDeparture: item.restrictions?.closedToDeparture ? 1 : 0,
      },
    })));
  }

  async pushDailyPrices(credentialsRef: string, externalPropertyId: string, rates: RateSnapshot[]): Promise<SyncResult> {
    return this.pushCalendar(credentialsRef, rates.map((rate) => ({
      roomId: rate.externalRoomTypeId,
      from: this.date(rate.date),
      to: this.date(rate.date),
      offers: [{ offerId: this.number(rate.externalRatePlanId), price: rate.amount }],
    })));
  }

  async pushRatePlans(credentialsRef: string, externalPropertyId: string, ratePlans: RatePlanSnapshot[]): Promise<SyncResult> {
    try {
      const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
      await Beds24AccountApiScheduler.execute(accountId, credentialsRef, '/inventory/rooms/offers', {
        method: 'POST',
        body: JSON.stringify(ratePlans.map((plan) => ({
          roomId: this.number(plan.externalRoomTypeId),
          offerId: this.number(plan.externalRatePlanId),
          name: plan.name,
          ...(plan.currency ? { currency: plan.currency } : {}),
          ...(plan.minStay !== undefined ? { minStay: plan.minStay } : {}),
          ...(plan.maxStay !== undefined ? { maxStay: plan.maxStay } : {}),
        }))),
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private date(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private number(value: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid Beds24 numeric identifier: ${value}`);
    return parsed;
  }

  private async pushCalendar(credentialsRef: string, rows: any[]): Promise<SyncResult> {
    try {
      const accountId = Beds24TokenManager.getAccountKey(credentialsRef);
      const byRoom = new Map<string, any[]>();
      for (const row of rows) {
        const existing = byRoom.get(row.roomId) || [];
        const { roomId, ...calendarRow } = row;
        existing.push(calendarRow);
        byRoom.set(row.roomId, existing);
      }
      await Beds24AccountApiScheduler.execute(accountId, credentialsRef, '/inventory/rooms/calendar', {
        method: 'POST',
        body: JSON.stringify([...byRoom].map(([roomId, calendar]) => ({ roomId: this.number(roomId), calendar }))),
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
