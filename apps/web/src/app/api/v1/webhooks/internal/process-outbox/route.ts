import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { ParsedReservation } from '@/lib/integrations/ota/types';
import { OTAReservationService } from '@/lib/integrations/ota/reservation-service';
import { OTALogger } from '@/lib/integrations/ota/logger';
import { errorResponse, successResponse } from '@/lib/api-response';
import { Receiver } from '@upstash/qstash';

async function verifyQStashSignature(req: NextRequest, rawBody: string) {
    if (process.env.NODE_ENV === 'development' && process.env.IGNORE_QSTASH_SIGNATURE === 'true') {
        return true;
    }
    const signature = req.headers.get('upstash-signature');
    if (!signature) throw new Error('Missing QStash signature');

    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
    });

    return await receiver.verify({ signature, body: rawBody });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    try {
        await verifyQStashSignature(req, rawBody);
    } catch (e: any) {
        return errorResponse('UNAUTHORIZED', 'Invalid signature', 401);
    }

    const body = JSON.parse(rawBody);
    const { outboxEventId } = body;

    if (!outboxEventId) return errorResponse('BAD_REQUEST', 'outboxEventId is required', 400);

    // Atomic Claiming: UPDATE PENDING -> PROCESSING
    const claimResult = await prisma.outboxEvent.updateMany({
        where: { id: outboxEventId, status: 'PENDING' },
        data: { status: 'PROCESSING' }
    });

    if (claimResult.count === 0) {
        const eventState = await prisma.outboxEvent.findUnique({ where: { id: outboxEventId }});
        if (!eventState) return errorResponse('NOT_FOUND', 'Outbox event not found', 404);
        
        if (eventState.status === 'COMPLETED' || eventState.status === 'DRY_RUN') {
            return successResponse({ message: 'Already processed' });
        }
        return errorResponse('LOCKED', 'Event is currently being processed or has failed permanently', 423);
    }

    const event = await prisma.outboxEvent.findUnique({ where: { id: outboxEventId } });

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
                data: { status: 'DRY_RUN', processedAt: new Date() }
             });
             return successResponse({ message: 'Dry run completed successfully' });
        }

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'COMPLETED', processedAt: new Date() }
        });

      } catch (err: any) {
        OTALogger.error('OTA_PROCESS_ERROR', err, { eventId: event.id });

        const isPermanent = err.message.includes('not belong') || err.message.includes('Unmapped') || err.message.includes('Unsupported') || err.message.includes('not authorized');
        
        if (isPermanent) {
            await prisma.outboxEvent.update({
                where: { id: event.id },
                data: { status: 'FAILED', lastError: err.message || 'Permanent error' }
            });
            return successResponse({ message: 'Permanent failure recorded' });
        }

        // Transient failure (including Prisma P2002 duplicate inserts from concurrent racing)
        const attempts = event.attemptCount + 1;
        const jitter = Math.floor(Math.random() * 1000 * 60);
        const backoffMs = Math.pow(2, attempts) * 1000 * 60 + jitter;

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: attempts >= 5 ? 'FAILED' : 'PENDING',
            attemptCount: attempts,
            lastError: err.message || 'Transient error',
            nextAttemptAt: attempts < 5 ? new Date(Date.now() + backoffMs) : null
          }
        });

        return errorResponse('TRANSIENT_ERROR', 'Transient failure, please retry', 500);
      }
    }

    return successResponse({ message: 'Event processed successfully' });

  } catch (error: any) {
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
