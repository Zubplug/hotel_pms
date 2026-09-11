export type ChannelProvider = 'CHANNEX' | 'BOOKING_COM' | 'EXPEDIA';

export interface RemoteRoom {
  externalId: string;
  name: string;
  maxOccupancy?: number;
  metadata?: any;
}

export interface RemoteRatePlan {
  externalId: string;
  name: string;
  currency?: string;
  metadata?: any;
}

export interface ParsedGuest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  country?: string;
}

export type OtaPaymentInfo = {
  method:
    | "PAY_AT_PROPERTY"
    | "OTA_COLLECTED"
    | "OTA_VIRTUAL_CARD"
    | "DEPOSIT"
    | "UNKNOWN";

  status:
    | "UNPAID"
    | "OTA_COLLECTED"
    | "PENDING_CHARGE"
    | "PARTIALLY_PAID"
    | "PAID"
    | "FAILED"
    | "UNKNOWN";

  amount?: number;
  currency?: string;

  externalReference?: string;

  settlementStatus?:
    | "PENDING"
    | "SETTLED"
    | "PARTIALLY_SETTLED"
    | "FAILED";
};

export interface ParsedReservation {
  externalReservationId: string;
  externalRevision?: string;
  provider: ChannelProvider;
  externalStatus: 'CONFIRMED' | 'MODIFIED' | 'CANCELLED';
  
  channelConnectionId?: string; // Resolved internally
  
  checkIn: Date;
  checkOut: Date;
  
  adults: number;
  children: number;
  
  externalRoomTypeId: string;
  externalRatePlanId: string;
  
  totalAmount: number;
  currency: string;
  
  guest: ParsedGuest;
  
  specialRequests?: string;
  payment: OtaPaymentInfo;
  
  rawPayload: any;
}

export interface AvailabilitySnapshot {
  date: Date; // Should be YYYY-MM-DD
  externalRoomTypeId: string;
  availableRooms: number;
  blockedRooms?: number;
  restrictions?: {
    closed?: boolean;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
}

export interface RateSnapshot {
  date: Date;
  externalRoomTypeId: string;
  externalRatePlanId: string;
  amount: number;
  currency: string;
  minStay?: number;
  maxStay?: number;
}

export interface WebhookResponse {
  statusCode: number;
  body?: any;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  details?: any;
}
