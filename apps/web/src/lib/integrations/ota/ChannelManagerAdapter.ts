import { NextRequest } from 'next/server';
import { 
  AvailabilitySnapshot, 
  ParsedReservation, 
  RatePlanSnapshot,
  RateSnapshot, 
  RemoteRatePlan, 
  RemoteRoom, 
  SyncResult, 
  WebhookResponse 
} from './types';

export interface ChannelManagerAdapter {
  providerName: string;
  
  // Connection / Config
  testConnection(credentialsRef: string): Promise<boolean>;
  fetchRemoteRooms(credentialsRef: string): Promise<RemoteRoom[]>;
  fetchRemoteRatePlans(credentialsRef: string): Promise<RemoteRatePlan[]>;
  
  // Inbound Webhooks
  verifyWebhookSignature(req: NextRequest, rawBody: string, secret?: string): Promise<boolean>;
  parseWebhookReservation(rawPayload: any): ParsedReservation;
  fetchFullReservation?(credentialsRef: string, externalPropertyId: string, externalReservationId: string): Promise<ParsedReservation>;
  
  // Outbound Sync
  pushAvailability(credentialsRef: string, externalPropertyId: string, inventory: AvailabilitySnapshot[]): Promise<SyncResult>;
  pushRates(credentialsRef: string, externalPropertyId: string, rates: RateSnapshot[]): Promise<SyncResult>;
  pushRestrictions?(credentialsRef: string, externalPropertyId: string, restrictions: AvailabilitySnapshot[]): Promise<SyncResult>;
  pushDailyPrices?(credentialsRef: string, externalPropertyId: string, rates: RateSnapshot[]): Promise<SyncResult>;
  pushRatePlans?(credentialsRef: string, externalPropertyId: string, ratePlans: RatePlanSnapshot[]): Promise<SyncResult>;
}
