import { NextRequest } from 'next/server';
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
    
    // 1. Verify Authentication / Signature
    const isValid = await adapter.verifyWebhookSignature(req, rawBody, process.env.OTA_WEBHOOK_SECRET);
    if (!isValid) {
      OTALogger.warn('webhook_unauthorized', { providerId, ip: req.headers.get('x-forwarded-for') });
      return new Response('Unauthorized Webhook Signature', { status: 401 });
    }

    // 2. Parse Payload safely
    let jsonPayload;
    try {
      jsonPayload = JSON.parse(rawBody);
    } catch (e) {
      OTALogger.warn('webhook_invalid_json', { providerId });
      return new Response('Invalid JSON payload', { status: 400 });
    }

    // 3. Delegate to Adapter to normalize
    let parsedRes;
    try {
        parsedRes = adapter.parseWebhookReservation(jsonPayload);
    } catch (err: any) {
        if (err.message.includes('Unsupported multi-room')) {
             OTALogger.warn('webhook_unsupported_multi_room', { providerId, payload: jsonPayload });
             // We return 200 so the provider stops sending it, but log it heavily for manual intervention.
             return new Response('Accepted (Unsupported multi-room payload dropped)', { status: 200 });
        }
        throw err;
    }

    // 4. Resolve Channel Connection
    const connection = await prisma.channelConnection.findFirst({
      where: { 
        provider,
        status: 'CONNECTED',
      }
    });

    if (!connection) {
      OTALogger.warn(`webhook_no_connection`, { provider });
      return new Response('No active connection', { status: 404 });
    }

    parsedRes.channelConnectionId = connection.id;

    // 5. Store inbound webhook event in generic DB transaction (Idempotency)
    const txResult = await prisma.$transaction(async (tx: any) => {
      
      const safePayloadString = PayloadSanitizer.sanitizeForDatabase(parsedRes.rawPayload);

      // Record Sync Event for auditing
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

      // Write OutboxEvent to trigger the internal LodgeCore Reservation update
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

    // 6. Trigger QStash / queue publisher for the OutboxEvent here (async, non-blocking)
    await QueuePublisher.publishOutboxEvent(txResult.outboxId);

    OTALogger.info('webhook_accepted', { 
      provider, 
      externalReservationId: parsedRes.externalReservationId, 
      outboxId: txResult.outboxId 
    });

    return new Response('Accepted', { status: 202 });

  } catch (error: any) {
    OTALogger.error('webhook_unhandled_error', error, { providerId });
    return new Response('Internal Server Error', { status: 500 });
  }
}
