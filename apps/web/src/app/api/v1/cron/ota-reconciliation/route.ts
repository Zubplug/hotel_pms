import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { ProviderFactory } from '@/lib/integrations/ota/ProviderFactory';
import { OTALogger } from '@/lib/integrations/ota/logger';
import { Beds24TokenManager } from '@/lib/integrations/ota/providers/beds24/token-manager';
import { OTAReservationService } from '@/lib/integrations/ota/reservation-service';
import { hasEntitlement } from '@/lib/auth/entitlement';

export async function POST(req: NextRequest) {
  // Can be secured via QStash signature verification
  const BATCH_LIMIT = 50;
  let processedCount = 0;

  try {
    const connections = await prisma.channelConnection.findMany({
      where: {
        provider: 'BEDS24',
        status: 'CONNECTED',
      },
    });

    for (const connection of connections) {
      if (!connection.credentialsRef) continue;
      if (!(await hasEntitlement(connection.organizationId, 'ADDON_BEDS24'))) continue;

      // 1. Watermark logic
      const lastSync = connection.lastSuccessfulSync || new Date(Date.now() - 24 * 60 * 60 * 1000); // default to 24h ago
      // Add 15 min safety window overlap to catch bookings that fell through the cracks
      const syncSince = new Date(lastSync.getTime() - 15 * 60 * 1000);
      
      try {
        const adapter = ProviderFactory.getAdapter('BEDS24');
        const accountId = Beds24TokenManager.getAccountKey(connection.credentialsRef);
        
        // Dynamic import to fetch scheduler if needed, or we just rely on adapter.
        // Wait, Beds24Adapter doesn't expose fetchModifiedBookings yet.
        // Let's call it via the scheduler directly or add it to the adapter.
        const { Beds24AccountApiScheduler } = await import('@/lib/integrations/ota/providers/beds24/api-scheduler');
        
        // Beds24 API v2 uses `modifiedSince` in ISO format
        const modifiedSinceIso = syncSince.toISOString();
        
        const bookings = await Beds24AccountApiScheduler.execute<any[]>(
          accountId,
          connection.credentialsRef,
          `/bookings?modifiedSince=${modifiedSinceIso}`
        );

        if (!bookings || bookings.length === 0) {
          await prisma.channelConnection.update({
            where: { id: connection.id },
            data: { lastSuccessfulSync: new Date() }
          });
          continue;
        }

        // Process every repair synchronously. The watermark is advanced only
        // after all bookings in this reconciliation window succeed.
        for (const b of bookings) {
          const parsedRes = await (adapter as any).fetchFullReservation(
            connection.credentialsRef,
            connection.externalPropertyId,
            b.id
          );
          
          parsedRes.channelConnectionId = connection.id;

          await OTAReservationService.processReservation(
            connection.organizationId,
            connection.propertyId,
            parsedRes,
          );
          processedCount++;
        }

        // No partial watermark: any thrown repair error reaches the catch
        // block and leaves the prior watermark in place for the safety-window
        // retry.
        await prisma.channelConnection.update({
          where: { id: connection.id },
          data: { lastSuccessfulSync: new Date() }
        });

      } catch (err: any) {
        OTALogger.error('RECONCILIATION_FAILED', err, { connectionId: connection.id });
        
        // If auth failed, token might be expired or revoked.
        if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('invalid_token'))) {
          await prisma.channelConnection.update({
            where: { id: connection.id },
            data: { 
              status: 'ERROR',
              lastError: 'Beds24 Authentication failed. Please reconnect your account.',
              lastErrorAt: new Date()
            }
          });
        }
        // Don't update watermark so we retry the same window next time
      }
    }

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    OTALogger.error('CRON_OTA_RECONCILIATION_ERROR', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
