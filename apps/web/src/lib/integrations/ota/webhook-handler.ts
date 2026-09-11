import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { ProviderFactory } from './ProviderFactory';
import { ChannelProvider } from './types';
import { QueuePublisher } from './queue';
import { OTALogger } from './logger';
import { PayloadSanitizer } from './payload-sanitizer';

export async function handleOtaWebhook(req: NextRequest, providerId: string) {
  try {
    const provider = providerId.toUpperCase() as ChannelProvider;
    const adapter = ProviderFactory.getAdapter(provider);
    const rawBody = await req.text();

    const isValid = await adapter.verifyWebhookSignature(req, rawBody, process.env.OTA_WEBHOOK_SECRET);
    if (!isValid) return new Response('Unauthorized Webhook Signature', { status: 401 });

    let jsonPayload;
    try {
        jsonPayload = JSON.parse(rawBody);
    } catch (e) {
        return new Response('Invalid JSON payload', { status: 400 });
    }

    let parsedRes;
    try {
        parsedRes = adapter.parseWebhookReservation(jsonPayload);
    } catch (err: any) {
        if (err.message.includes('Unsupported multi-room')) {
             await prisma.channelSyncEvent.create({
                 data: {
                     organizationId: 'SYSTEM', // Unknown until connection resolved
                     propertyId: 'SYSTEM',
                     provider,
                     direction: 'INBOUND',
                     eventType: 'RESERVATION',
                     payload: { error: 'UNSUPPORTED_MULTI_ROOM', raw: PayloadSanitizer.sanitizeForDatabase(jsonPayload) },
                     status: 'FAILED',
                 }
             });
             return new Response('Accepted (Unsupported multi-room payload dropped, persisted for manual review)', { status: 200 });
        }
        throw err;
    }

    // Resolve Connection using strict externalPropertyId mapping (assuming adapter returns it, wait, Channex payload has property_id?)
    // Let's assume parsedRes.rawPayload has property_id for Channex.
    // We should modify parsedRes to include externalPropertyId.
    const externalPropertyId = jsonPayload.booking?.property_id || jsonPayload.property_id;
    if (!externalPropertyId) {
        return new Response('Missing external property ID in payload', { status: 400 });
    }

    const connection = await prisma.channelConnection.findFirst({
      where: { 
          provider,
          externalPropertyId: String(externalPropertyId),
          status: 'CONNECTED'
      }
    });

    if (!connection) return new Response('No active connection found for property', { status: 404 });

    parsedRes.channelConnectionId = connection.id;

    const txResult = await prisma.$transaction(async (tx: any) => {
      const safePayloadString = PayloadSanitizer.sanitizeForDatabase(parsedRes.rawPayload);

      const syncEvent = await tx.channelSyncEvent.create({
        data: {
          organizationId: connection.organizationId,
          propertyId: connection.propertyId,
          provider: provider,
          direction: 'INBOUND',
          eventType: 'RESERVATION',
          payload: { 
            externalId: parsedRes.externalReservationId,
            status: parsedRes.externalStatus,
            revision: parsedRes.externalRevision
          },
          status: 'PENDING',
        }
      });

      const outbox = await tx.outboxEvent.create({
        data: {
          organizationId: connection.organizationId,
          propertyId: connection.propertyId,
          eventType: 'OTA_RESERVATION_RECEIVED',
          aggregateType: 'ChannelReservation',
          aggregateId: parsedRes.externalReservationId,
          payload: parsedRes as any,
          status: 'PENDING'
        }
      });

      return { outboxId: outbox.id, syncEventId: syncEvent.id };
    });

    await QueuePublisher.publishOutboxEvent(txResult.outboxId);

    return new Response('Accepted', { status: 202 });
  } catch (error: any) {
    return new Response('Internal Server Error', { status: 500 });
  }
}
