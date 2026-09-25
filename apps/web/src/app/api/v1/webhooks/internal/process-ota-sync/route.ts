import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { ProviderFactory } from '@/lib/integrations/ota/ProviderFactory';
import { Receiver } from '@upstash/qstash';
import { hasEntitlement } from '@/lib/auth/entitlement';
import type { SyncResult } from '@/lib/integrations/ota/types';

async function verifyQStashSignature(req: NextRequest, rawBody: string) {
  if (process.env.NODE_ENV === 'development' && process.env.IGNORE_QSTASH_SIGNATURE === 'true') return true;
  const signature = req.headers.get('upstash-signature');
  if (!signature) return false;
  return new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
  }).verify({ signature, body: rawBody });
}

export async function POST(req: NextRequest) {
  let syncEventId: string | null = null;
  const MAX_RETRIES = 5;

  try {
    const rawBody = await req.text();
    if (!await verifyQStashSignature(req, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    const body = JSON.parse(rawBody);
    syncEventId = body.syncEventId;

    if (!syncEventId) {
      return NextResponse.json({ error: 'Missing syncEventId' }, { status: 400 });
    }

    // 1. Fetch Event
    const syncEvent = await prisma.channelSyncEvent.findUnique({
      where: { id: syncEventId },
    });

    if (!syncEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (syncEvent.status === 'SUCCESS' || syncEvent.status === 'DEAD_LETTER') {
      return NextResponse.json({ message: 'Event already processed' }, { status: 200 });
    }

    // 2. Outbound Loop Prevention
    const payload = (syncEvent.payload as any) || {};
    const changeOrigin = payload.changeOrigin || 'LOCAL';

    if (changeOrigin === syncEvent.provider) {
      // Loop prevented: The change originated from the OTA, so we don't push it back.
      await prisma.channelSyncEvent.update({
        where: { id: syncEventId },
        data: {
          status: 'SUCCESS',
          error: `Skipped outbound sync: changeOrigin is ${changeOrigin} (Loop Prevention)`,
        },
      });
      return NextResponse.json({ message: 'Skipped (Loop Prevention)' }, { status: 200 });
    }

    // Mark as processing
    await prisma.channelSyncEvent.update({
      where: { id: syncEventId },
      data: { status: 'PROCESSING', attemptCount: { increment: 1 } },
    });

    // 3. Fetch Connection
    const connection = await prisma.channelConnection.findUnique({
      where: {
        propertyId_provider: {
          propertyId: syncEvent.propertyId,
          provider: syncEvent.provider,
        },
      },
      include: { property: true }
    });

    if (!connection || connection.status !== 'CONNECTED' || !connection.credentialsRef) {
      throw new Error(`Channel connection missing or inactive for ${syncEvent.provider}`);
    }

    if (syncEvent.provider === 'BEDS24') {
      const entitled = await hasEntitlement(connection.property.organizationId, 'ADDON_BEDS24');
      if (!entitled) {
        throw new Error('Payment Required: Organization does not have an active entitlement for BEDS24');
      }
    }

    const adapter = ProviderFactory.getAdapter(syncEvent.provider);
    let syncResult: SyncResult = { success: false, error: 'Unknown eventType' };

    // 4. Dispatch to Adapter based on EventType
    if (syncEvent.eventType === 'AVAILABILITY') {
      const inventory = payload.inventory || [];
      if (inventory.length > 0) {
        syncResult = await adapter.pushAvailability(
          connection.credentialsRef,
          connection.externalPropertyId,
          inventory
        );
      } else {
        syncResult = { success: true, error: undefined }; 
      }
    } else if (syncEvent.eventType === 'RATE') {
      const rates = payload.rates || [];
      if (rates.length > 0) {
        syncResult = await adapter.pushRates(
          connection.credentialsRef,
          connection.externalPropertyId,
          rates
        );
      } else {
        syncResult = { success: true, error: undefined };
      }
    } else if (syncEvent.eventType === 'RESTRICTIONS') {
      if (!adapter.pushRestrictions) throw new Error(`Provider ${syncEvent.provider} does not support restrictions`);
      syncResult = await adapter.pushRestrictions(connection.credentialsRef, connection.externalPropertyId, payload.restrictions || []);
    } else if (syncEvent.eventType === 'DAILY_PRICES') {
      if (!adapter.pushDailyPrices) throw new Error(`Provider ${syncEvent.provider} does not support daily prices`);
      syncResult = await adapter.pushDailyPrices(connection.credentialsRef, connection.externalPropertyId, payload.rates || []);
    } else if (syncEvent.eventType === 'RATE_PLANS') {
      if (!adapter.pushRatePlans) throw new Error(`Provider ${syncEvent.provider} does not support rate plans`);
      syncResult = await adapter.pushRatePlans(connection.credentialsRef, connection.externalPropertyId, payload.ratePlans || []);
    } else {
      throw new Error(`Unsupported eventType: ${syncEvent.eventType}`);
    }

    // 5. Handle Success/Failure
    if (syncResult.success) {
      await prisma.channelSyncEvent.update({
        where: { id: syncEventId },
        data: { status: 'SUCCESS', error: null },
      });
      return NextResponse.json({ success: true }, { status: 200 });
    } else {
      throw new Error(syncResult.error || 'Adapter push failed');
    }
  } catch (error: any) {
    console.error('[process-ota-sync] Error:', error);
    
    // Handle retries vs fatal failure
    if (syncEventId) {
      try {
        const currentEvent = await prisma.channelSyncEvent.findUnique({ where: { id: syncEventId } });
        if (currentEvent && currentEvent.attemptCount >= MAX_RETRIES) {
          await prisma.channelSyncEvent.update({
            where: { id: syncEventId },
            data: { status: 'DEAD_LETTER', error: error.message },
          });
          return NextResponse.json({ message: 'Max retries reached. Marked as FAILED.' }, { status: 200 }); 
          // We return 200 so QStash stops retrying since it's fundamentally failing and we recorded it.
        } else {
          await prisma.channelSyncEvent.update({
            where: { id: syncEventId },
            data: { error: error.message },
          });
        }
      } catch (dbError) {
        console.error('[process-ota-sync] Failed to update event status:', dbError);
      }
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 } // Returning 500 tells QStash to retry again later
    );
  }
}
