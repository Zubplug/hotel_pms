import { NextRequest } from 'next/server';
import prisma, { decrypt } from '@hotel-pms/db';
import { ProviderFactory } from './ProviderFactory';
import { ChannelProvider } from './types';
import { QueuePublisher } from './queue';
import { OTALogger } from './logger';
import { PayloadSanitizer } from './payload-sanitizer';

/**
 * Resolve the webhook secret for a specific ChannelConnection.
 *
 * Convention: ChannelConnection.credentialsRef stores the NAME of the
 * environment variable that holds the webhook secret for that connection.
 *
 * Example:
 *   credentialsRef = '{"iv":"...","content":"...","authTag":"..."}' (JSON string of encrypted webhookSecret)
 *
 * This keeps secrets out of plain text in the database while allowing each org/property
 * to have its own independent Channex account and webhook secret.
 */
function resolveConnectionSecret(credentialsRef: string): string | undefined {
  if (!credentialsRef || credentialsRef === 'none') return undefined;
  
  try {
    // Check if it's the old .env format first (fallback)
    if (!credentialsRef.startsWith('{')) {
      return process.env[credentialsRef];
    }
    
    // New encrypted JSON format
    const encryptedPayload = JSON.parse(credentialsRef);
    const decryptedJsonString = decrypt(encryptedPayload);
    const credentials = JSON.parse(decryptedJsonString);
    return credentials.webhookSecret;
  } catch (error) {
    console.error('Failed to resolve/decrypt connection secret', error);
    return undefined;
  }
}

export async function handleOtaWebhook(req: NextRequest, providerId: string) {
  try {
    const provider = providerId.toUpperCase() as ChannelProvider;
    const adapter = ProviderFactory.getAdapter(provider);
    const rawBody = await req.text();

    // ── Step 1: Parse JSON minimally to extract the external property ID
    // so we can resolve the connection (and its secret) BEFORE verifying
    // the signature. This avoids using a single global secret.
    let jsonPayload: any;
    try {
      jsonPayload = JSON.parse(rawBody);
    } catch {
      return new Response('Invalid JSON payload', { status: 400 });
    }

    // Channex embeds the property ID at booking.property_id or property_id
    const externalPropertyId =
      jsonPayload?.booking?.property_id ??
      jsonPayload?.property_id ??
      null;

    if (!externalPropertyId) {
      return new Response('Missing external property ID in payload', { status: 400 });
    }

    // ── Step 2: Resolve the ChannelConnection for this specific property
    // Each connection is scoped to one (org, property) pair — strict tenant isolation.
    const connection = await prisma.channelConnection.findFirst({
      where: {
        provider,
        externalPropertyId: String(externalPropertyId),
        status: 'CONNECTED',
      },
    });

    if (!connection) {
      OTALogger.warn('OTA_WEBHOOK_NO_CONNECTION', {
        provider,
        externalPropertyId,
        message: 'No CONNECTED ChannelConnection found for this property',
      });
      return new Response('No active connection found for property', { status: 404 });
    }

    // ── Step 3: Verify signature using the connection-specific secret
    // Fail closed: if credentialsRef is not set or the env var is missing,
    // reject the webhook rather than proceeding without verification.
    const webhookSecret = resolveConnectionSecret(connection.credentialsRef ?? '');
    if (!webhookSecret) {
      OTALogger.error('OTA_WEBHOOK_NO_SECRET', new Error('credentialsRef not configured'), {
        connectionId: connection.id,
        credentialsRef: connection.credentialsRef,
        message: 'Webhook secret env var missing or credentialsRef not set. Set the env var referenced by credentialsRef.',
      });
      return new Response('Webhook secret not configured for this connection', { status: 500 });
    }

    const isValid = await adapter.verifyWebhookSignature(req, rawBody, webhookSecret);
    if (!isValid) {
      OTALogger.warn('OTA_WEBHOOK_INVALID_SIGNATURE', {
        connectionId: connection.id,
        provider,
        externalPropertyId,
      });
      return new Response('Unauthorized Webhook Signature', { status: 401 });
    }

    // ── Step 4: Full parse via provider adapter
    let parsedRes;
    try {
      parsedRes = adapter.parseWebhookReservation(jsonPayload);
    } catch (err: any) {
      if (err.message?.includes('Unsupported multi-room')) {
        // Persist FAILED event for manual review (org/property known at this point)
        await prisma.channelSyncEvent.create({
          data: {
            organizationId: connection.organizationId,
            propertyId:     connection.propertyId,
            provider,
            direction:      'INBOUND',
            eventType:      'RESERVATION',
            payload: {
              error: 'UNSUPPORTED_MULTI_ROOM',
              raw:   PayloadSanitizer.sanitizeForDatabase(jsonPayload),
            },
            status: 'FAILED',
          },
        });
        return new Response(
          'Accepted (multi-room payload persisted as FAILED for manual review)',
          { status: 200 },
        );
      }
      throw err;
    }

    // Attach the resolved connection ID so the outbox worker knows which connection
    parsedRes.channelConnectionId = connection.id;

    // ── Step 5: Atomically persist ChannelSyncEvent + OutboxEvent
    const txResult = await prisma.$transaction(async (tx: any) => {
      const syncEvent = await tx.channelSyncEvent.create({
        data: {
          organizationId: connection.organizationId,
          propertyId:     connection.propertyId,
          provider,
          direction:      'INBOUND',
          eventType:      'RESERVATION',
          payload: {
            externalId: parsedRes.externalReservationId,
            status:     parsedRes.externalStatus,
            revision:   parsedRes.externalRevision,
          },
          status: 'PENDING',
        },
      });

      const outbox = await tx.outboxEvent.create({
        data: {
          organizationId: connection.organizationId,
          propertyId:     connection.propertyId,
          eventType:      'OTA_RESERVATION_RECEIVED',
          aggregateType:  'ChannelReservation',
          aggregateId:    parsedRes.externalReservationId,
          payload:        parsedRes as any,
          status:         'PENDING',
        },
      });

      return { outboxId: outbox.id, syncEventId: syncEvent.id };
    });

    // ── Step 6: Publish to QStash (outside tx — fire-and-forget)
    await QueuePublisher.publishOutboxEvent(txResult.outboxId);

    return new Response('Accepted', { status: 202 });
  } catch (error: any) {
    OTALogger.error('OTA_WEBHOOK_UNHANDLED', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
