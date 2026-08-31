import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticateAgent } from '@/lib/hardware-auth';

export async function GET(req: NextRequest) {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult) return errorResponse('UNAUTHORIZED', 'Invalid agent credentials', 401);
    const { agent, ctx } = authResult;

    // Update heartbeat (lightweight — full heartbeat via dedicated /heartbeat endpoint)
    await prisma.hardwareAgent.update({
      where: { id: agent.id },
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
