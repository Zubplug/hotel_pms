import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import bcrypt from 'bcryptjs';
import { TenantContext } from '@/lib/organization-access';

export async function authenticateAgent(req: NextRequest): Promise<{ agent: any, ctx: TenantContext } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) return null;

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) return null;

  const agentId = decoded.slice(0, colonIdx);
  const agentSecret = decoded.slice(colonIdx + 1);

  const agent = await prisma.hardwareAgent.findUnique({
    where: { id: agentId },
    include: { property: true }
  });
  if (!agent || !agent.enabled || !agent.property) return null;

  const valid = await bcrypt.compare(agentSecret, agent.agentSecretHash);
  if (!valid) return null;

  const ctx: TenantContext = {
    userId: agent.id,
    organizationId: agent.property.organizationId,
    propertyIds: [agent.propertyId],
    role: 'HARDWARE_AGENT',
    permissions: [],
    outletIds: []
  };

  return { agent, ctx };
}
