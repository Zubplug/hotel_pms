import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return errorResponse('UNAUTHORIZED', 'Missing agent token', 401);
    const agentId = authHeader.replace('Bearer ', '');

    const { id } = await params;
    const body = await req.json();
    const { status, operationStatus, errorCode, errorMessage } = body;

    const command = await prisma.lockCommand.findUnique({
      where: { id },
      include: { operation: true },
    });

    if (!command) return errorResponse('NOT_FOUND', 'Command not found', 404);
    if (command.agentId !== agentId) return errorResponse('FORBIDDEN', 'Command belongs to another agent', 403);

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
