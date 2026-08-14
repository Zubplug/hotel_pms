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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const agent = await authenticateAgent(req);
    if (!agent) return errorResponse('UNAUTHORIZED', 'Invalid agent credentials', 401);

    const { id } = await params;
    const body = await req.json();
    const { status, operationStatus, errorCode, errorMessage } = body;

    const command = await prisma.lockCommand.findUnique({
      where: { id },
      include: { operation: true },
    });

    if (!command) return errorResponse('NOT_FOUND', 'Command not found', 404);
    if (command.agentId !== agent.id) return errorResponse('FORBIDDEN', 'Command belongs to another agent', 403);

    // Update command
    const updateData: Record<string, unknown> = { status };
    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
      updateData.errorCode = errorCode;
      updateData.errorMessage = errorMessage;
    }

    const updatedCommand = await prisma.lockCommand.update({
      where: { id },
      data: updateData,
    });

    // Update the parent operation to reflect the real-time hardware status
    if (command.operation && operationStatus) {
      await prisma.lockOperation.update({
        where: { id: command.operation.id },
        data: { 
          status: operationStatus,
          errorCode: errorCode,
          errorMessage: errorMessage,
        },
      });

      // If this was the final state for an issue command, update the credential
      if (status === 'COMPLETED' && command.commandType === 'ENCODE' && command.operation.credentialId) {
        await prisma.lockCredential.update({
          where: { id: command.operation.credentialId },
          data: { status: 'ACTIVE', issuedAt: new Date() },
        });
      }
    }

    return successResponse({ command: updatedCommand });
  } catch (err) {
    console.error('[Hardware API PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
