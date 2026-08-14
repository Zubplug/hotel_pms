import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import bcrypt from 'bcryptjs';

// Shared helper: authenticate a hardware agent via Basic auth (agentId:agentSecret)
export async function authenticateAgent(req: NextRequest) {
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

// POST /api/v1/hardware/heartbeat
// Called every 15s by the Windows agent to report liveness and hardware status.
export async function POST(req: NextRequest) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) return errorResponse('UNAUTHORIZED', 'Invalid agent credentials', 401);

    const body = await req.json().catch(() => ({}));
    const hardwareStatus = body.hardwareStatus ?? 'UNKNOWN';

    await prisma.hardwareAgent.update({
      where: { id: agent.id },
      data: {
        status: 'ONLINE',
        hardwareStatus,
        lastHeartbeat: new Date(),
        lastConnectedAt: agent.status === 'OFFLINE' ? new Date() : undefined,
      },
    });

    return successResponse({ ok: true });
  } catch (err) {
    console.error('[Heartbeat POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
