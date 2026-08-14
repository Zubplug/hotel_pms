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
    const { status, operationStatus, errorCode, errorMessage, cardSnr, CardSnr } = body;
    const actualCardSnr = cardSnr || CardSnr;

    const command = await prisma.lockCommand.findUnique({
      where: { id },
      include: { operation: true },
    });

    if (!command) return errorResponse('NOT_FOUND', 'Command not found', 404);
    if (command.agentId !== agent.id) return errorResponse('FORBIDDEN', 'Command belongs to another agent', 403);

    const updateData: Record<string, unknown> = { status };
    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
      updateData.errorCode = errorCode;
      updateData.errorMessage = errorMessage;
    }

    // Use a transaction for the critical state transitions
    await prisma.$transaction(async (tx) => {
      // 1. Update Command
      await tx.lockCommand.update({
        where: { id },
        data: updateData,
      });

      // 2. Update Operation
      if (command.operation) {
        await tx.lockOperation.update({
          where: { id: command.operation.id },
          data: { 
            status: operationStatus || (status === 'COMPLETED' ? 'SUCCESS' : status),
            errorCode: errorCode,
            errorMessage: errorMessage,
          },
        });

        // 3. Strict Check-In State Machine Transition
        if (status === 'COMPLETED' && command.commandType === 'ENCODE') {
          const res = await tx.reservation.findUnique({ where: { id: command.operation.reservationId } });
          
          if (res && res.status !== 'CHECKED_IN' && res.status !== 'CHECKED_OUT' && res.status !== 'CANCELLED') {
            // A. Create Lock Credential with the physical Card SNR
            await tx.lockCredential.create({
              data: {
                reservationId: command.operation.reservationId,
                roomId: command.operation.roomId,
                lockId: command.operation.lockId,
                credentialType: 'rfid',
                status: 'ACTIVE',
                cardSerialNumber: actualCardSnr,
                issueOperationId: command.operation.id,
                validFrom: new Date(),
                validUntil: res.checkOut,
              }
            });

            // B. Mark Reservation as Checked In
            await tx.reservation.update({
              where: { id: command.operation.reservationId },
              data: { status: 'CHECKED_IN' }
            });

            // C. Mark Room as Occupied
            await tx.room.update({
              where: { id: command.operation.roomId },
              data: { status: 'OCCUPIED' }
            });
          }
        }
      }
    });

    return successResponse({ success: true });
  } catch (err) {
    console.error('[Hardware API PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
