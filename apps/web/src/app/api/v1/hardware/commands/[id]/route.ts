import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import bcrypt from 'bcryptjs';
import { NotificationEngine } from '@/lib/notification-engine';

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
    const { status, operationStatus, errorCode, errorMessage, cardSnr, CardSnr, data } = body;
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
      if (data) updateData.responseData = data;
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

        // 3. Credential and Reservation State Machine Transition
        if (status === 'COMPLETED' && command.commandType === 'ENCODE' && command.operation.reservationId && command.operation.roomId && command.operation.lockId) {
          
          // A. Activate the PENDING credential created by the orchestrator/provider
          if (command.operation.credentialId) {
            await tx.lockCredential.update({
              where: { id: command.operation.credentialId },
              data: {
                status: 'ACTIVE',
                cardSerialNumber: actualCardSnr,
              }
            });
          } else {
            // Fallback: Create Lock Credential with the physical Card SNR if not found
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
                validUntil: new Date(), // We don't have res.checkOut here easily, but this is fallback
              }
            });
          }

          const res = await tx.reservation.findUnique({ 
            where: { id: command.operation.reservationId },
            include: { property: true }
          });
          
          if (res && res.status !== 'CHECKED_IN' && res.status !== 'CHECKED_OUT' && res.status !== 'CANCELLED') {
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

            // D. Write Atomic Audit Logs for Check-In
            const meta = (command.operation.metadata as Record<string, any>) || {};
            const userId = meta.initiatedBy || agent.id; // Fallback to agent if not set
            const userEmail = meta.initiatedByEmail || 'hardware@system.local';
            const userRole = meta.initiatedByRole || 'SYSTEM';

            const commonAuditData = {
              organizationId: res.property.organizationId,
              propertyId: command.operation.propertyId,
              userId: userId,
              userEmail: userEmail,
              userRole: userRole,
              ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
              userAgent: req.headers.get('user-agent') || 'Hardware Agent',
              requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
            };

            await tx.auditLog.createMany({
              data: [
                {
                  ...commonAuditData,
                  action: 'LOCK_CREDENTIAL_ISSUED',
                  resource: 'Reservation',
                  resourceId: res.id,
                  newValue: { cardSerialNumber: actualCardSnr, roomId: command.operation.roomId }
                },
                {
                  ...commonAuditData,
                  action: 'ROOM_STATUS_CHANGED',
                  resource: 'Room',
                  resourceId: command.operation.roomId,
                  previousValue: { status: 'AVAILABLE' }, // Assuming it was available/reserved
                  newValue: { status: 'OCCUPIED' }
                },
                {
                  ...commonAuditData,
                  action: 'RESERVATION_CHECKED_IN',
                  resource: 'Reservation',
                  resourceId: res.id,
                  previousValue: { status: res.status },
                  newValue: { status: 'CHECKED_IN' }
                }
              ]
            });

            return {
              didCheckIn: true,
              organizationId: res.property.organizationId,
              propertyId: command.operation.propertyId,
              reservationId: res.id
            };

          } else if (res && res.status === 'CHECKED_IN') {
             // For Extension or Additional Cards, just log the credential issuance
             const meta = (command.operation.metadata as Record<string, any>) || {};
             const userId = meta.initiatedBy || agent.id; // Fallback to agent if not set
             const userEmail = meta.initiatedByEmail || 'hardware@system.local';
             const userRole = meta.initiatedByRole || 'SYSTEM';
 
             const commonAuditData = {
               organizationId: res.property.organizationId,
               propertyId: command.operation.propertyId,
               userId: userId,
               userEmail: userEmail,
               userRole: userRole,
               ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
               userAgent: req.headers.get('user-agent') || 'Hardware Agent',
               requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
             };
 
             await tx.auditLog.create({
               data: {
                 ...commonAuditData,
                 action: 'LOCK_CREDENTIAL_ISSUED',
                 resource: 'Reservation',
                 resourceId: res.id,
                 newValue: { cardSerialNumber: actualCardSnr, roomId: command.operation.roomId, type: 'EXTENSION_OR_ADDITIONAL' }
               }
             });
          }
        }
      }
      return null;
    });

    if (txResult?.didCheckIn) {
      await NotificationEngine.emit({
        type: 'CHECK_IN',
        organizationId: txResult.organizationId,
        propertyId: txResult.propertyId,
        entityType: 'reservation',
        entityId: txResult.reservationId,
        idempotencyKey: `checkin_${txResult.reservationId}_${Date.now()}`
      });
    }

    return successResponse({ success: true });
  } catch (err) {
    console.error('[Hardware API PATCH]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
