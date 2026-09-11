import { NextRequest } from 'next/server';
import { 
  AvailabilitySnapshot, 
  ParsedReservation, 
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
  
  // Outbound Sync
  pushAvailability(credentialsRef: string, externalPropertyId: string, inventory: AvailabilitySnapshot[]): Promise<SyncResult>;
  pushRates(credentialsRef: string, externalPropertyId: string, rates: RateSnapshot[]): Promise<SyncResult>;
}
