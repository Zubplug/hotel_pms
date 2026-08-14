import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import bcrypt from 'bcryptjs';

async function authenticateAgent(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) return null;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) return null;
  const agentId = decoded.slice(0, colonIdx);
  const agentSecret = decoded.slice(colonIdx + 1);
  const agent = await prisma.hardwareAgent.findUnique({ where: { id: agentId } });
  if (!agent || !agent.enabled) return null;
  const valid = await bcrypt.compare(agentSecret, agent.agentSecretHash);
  if (!valid) return null;
  return agent;
}

export async function GET(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) return errorResponse('UNAUTHORIZED', 'Invalid agent credentials', 401);

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
