import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate hardware agent (simulate for now, in prod verify device cert/token)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return errorResponse('UNAUTHORIZED', 'Missing agent token', 401);
    
    const agentId = authHeader.replace('Bearer ', '');
    const agent = await prisma.hardwareAgent.findUnique({ where: { id: agentId } });
    
    if (!agent) return errorResponse('UNAUTHORIZED', 'Invalid agent identity', 401);

    // Update heartbeat
    await prisma.hardwareAgent.update({
      where: { id: agentId },
      data: { lastHeartbeat: new Date(), status: 'ONLINE' },
    });

    // 2. Fetch QUEUED commands for this agent
    const command = await prisma.lockCommand.findFirst({
      where: {
        agentId: agent.id,
        status: 'QUEUED',
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!command) {
      return successResponse({ command: null });
    }

    // 3. Atomically claim the command
    const claimedCommand = await prisma.lockCommand.update({
      where: { id: command.id, status: 'QUEUED' },
      data: {
        status: 'CLAIMED',
        claimedAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + 60000), // 60 second lease
        attempts: { increment: 1 },
      },
      include: {
        operation: true
      }
    });

    // Update Operation Status
    if (claimedCommand.operation) {
      await prisma.lockOperation.update({
        where: { id: claimedCommand.operation.id },
        data: { status: 'DISPATCHED' },
      });
    }

    return successResponse({ command: claimedCommand });

  } catch (err) {
    console.error('[Hardware API GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
