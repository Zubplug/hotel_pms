import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ParsedReservation } from '@/lib/integrations/ota/types';
import { OTAReservationService } from '@/lib/integrations/ota/reservation-service';
import { OTALogger } from '@/lib/integrations/ota/logger';
import { errorResponse, successResponse } from '@/lib/api-response';

// QStash validation (In production, use upstash/qstash/nextjs)
async function verifyQStashSignature(req: NextRequest) {
    if (process.env.NODE_ENV === 'development' && process.env.IGNORE_QSTASH_SIGNATURE === 'true') {
        return true;
    }
    const signature = req.headers.get('upstash-signature');
    if (!signature) throw new Error('Missing QStash signature');
    // Implement actual QStash verification here.
    return true;
}

export async function POST(req: NextRequest) {
  try {
    try {
        await verifyQStashSignature(req);
    } catch (e: any) {
        return errorResponse('UNAUTHORIZED', 'Invalid signature', 401);
    }

    const body = await req.json();
    const { outboxEventId } = body;

    if (!outboxEventId) {
      return errorResponse('BAD_REQUEST', 'outboxEventId is required', 400);
    }

    // Atomic Claiming: UPDATE PENDING -> PROCESSING
    const claimResult = await prisma.outboxEvent.updateMany({
        where: { id: outboxEventId, status: 'PENDING' },
        data: { status: 'PROCESSING' }
    });

    if (claimResult.count === 0) {
        const eventState = await prisma.outboxEvent.findUnique({ where: { id: outboxEventId }});
        if (!eventState) return errorResponse('NOT_FOUND', 'Outbox event not found', 404);
        
        // If it's DRY_RUN or COMPLETED, return success. If PROCESSING by another worker, ignore.
        if (eventState.status === 'COMPLETED' || eventState.status === 'DRY_RUN') {
            return successResponse({ message: 'Already processed' });
        }
        return errorResponse('LOCKED', 'Event is currently being processed or has failed permanently', 423);
    }

    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId }
    });

    if (!event) return errorResponse('NOT_FOUND', 'Outbox event not found', 404);

    if (event.eventType === 'OTA_RESERVATION_RECEIVED') {
      const parsedRes = event.payload as unknown as ParsedReservation;

      try {
        const result = await OTAReservationService.processReservation(
          event.organizationId,
          event.propertyId,
          parsedRes
        );

        if (result.dryRun) {
             await prisma.outboxEvent.update({
                where: { id: event.id },
                data: {
                    status: 'DRY_RUN', // Keep it in DB without completing it permanently
                    processedAt: new Date(),
                }
             });
             return successResponse({ message: 'Dry run completed successfully' });
        }

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          }
        });

      } catch (err: any) {
        OTALogger.error('OTA_PROCESS_ERROR', err, { eventId: event.id });

        const isPermanent = err.message.includes('not belong') || err.message.includes('Unmapped') || err.message.includes('Unsupported');
        
        if (isPermanent) {
            await prisma.outboxEvent.update({
                where: { id: event.id },
                data: {
                    status: 'FAILED',
                    lastError: err.message || 'Permanent processing error',
                }
            });
            // Return 200 so QStash doesn't retry permanent failures
            return successResponse({ message: 'Permanent failure recorded' });
        }

        // Transient failure
        const attempts = event.attemptCount + 1;
        const jitter = Math.floor(Math.random() * 1000 * 60); // Jitter up to 1m
        const backoffMs = Math.pow(2, attempts) * 1000 * 60 + jitter; // Exponential

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: attempts >= 5 ? 'FAILED' : 'PENDING',
            attemptCount: attempts,
            lastError: err.message || 'Transient processing error',
            nextAttemptAt: attempts < 5 ? new Date(Date.now() + backoffMs) : null
          }
        });

        // Return 500 to let QStash automatically retry
        return errorResponse('TRANSIENT_ERROR', 'Transient failure, please retry', 500);
      }
    }

    return successResponse({ message: 'Event processed successfully' });

  } catch (error: any) {
    console.error('[ProcessOutbox] Critical failure:', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
