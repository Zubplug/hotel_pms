import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticateAgent } from '@/lib/hardware-auth';

// POST /api/v1/hardware/heartbeat
// Called every 15s by the Windows agent to report liveness and hardware status.
export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult) return errorResponse('UNAUTHORIZED', 'Invalid agent credentials', 401);
    const { agent, ctx } = authResult;

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
