import prisma from '@hotel-pms/db';
import { IssueCredentialParams } from '../orchestrator';

export const delunsLockProvider = {
  async issueCredential(params: IssueCredentialParams, agentId: string) {
    const {
      reservationId, guestId, roomId, lockId, propertyId,
      type, validFrom, validUntil, idempotencyKey
    } = params;

    // We no longer strictly validate lockConfiguration for 'provider' or 'dlsCoID' 
    // because the hardware agent uses TP_MakeGuestCardEx which only requires 
    // roomNo, checkIn, checkOut, and flags.
    
    // 1. Fetch the room to get the room number
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new Error('Room not found');

    const formatNigeriaTime = (d: Date, forceTime?: string) => {
      const now = new Date(d);
      now.setUTCHours(now.getUTCHours() + 1); // Shift to Nigeria Time (UTC+1)
      const yyyy = now.getUTCFullYear();
      const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(now.getUTCDate()).padStart(2, '0');
      if (forceTime) return `${yyyy}-${mm}-${dd}T${forceTime}`;
      
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const min = String(now.getUTCMinutes()).padStart(2, '0');
      const ss = String(now.getUTCSeconds()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
    };

    // Calculate exact current time for check-in to allow immediate entry
    const now = new Date();
    now.setUTCHours(now.getUTCHours() + 1);
    const currentHH = String(now.getUTCHours()).padStart(2, '0');
    const currentMin = String(now.getUTCMinutes()).padStart(2, '0');
    const currentSec = String(now.getUTCSeconds()).padStart(2, '0');
    const exactTimeStr = `${currentHH}:${currentMin}:${currentSec}`;

    // 2. Create all records in a single transaction
    const operation = await prisma.$transaction(async (tx: any) => {
      const credential = await tx.lockCredential.create({
        data: {
          reservationId,
          guestId,
          roomId,
          lockId,
          credentialType: 'rfid',
          status: 'PENDING',
          validFrom,
          validUntil,
          metadata: { type },
        },
      });

      const op = await tx.lockOperation.create({
        data: {
          idempotencyKey: idempotencyKey!,
          propertyId,
          lockId,
          roomId,
          reservationId,
          credentialId: credential.id,
          agentId,
          operation: 'ENCODE_CARD',
          status: 'QUEUED',
        },
      });

      // The Hardware Agent (CommandWorker.cs) expects "ENCODE" as commandType 
      // and { roomNo, checkIn, checkOut, flags } as the payload
      const command = await tx.lockCommand.create({
        data: {
          operationId: op.id,
          agentId,
          commandType: 'ENCODE',
          status: 'QUEUED',
          payload: {
            roomNo: room.number,
            checkIn: formatNigeriaTime(validFrom, exactTimeStr),
            checkOut: formatNigeriaTime(validUntil, '12:00:00'),
            flags: 0 // Replace old card
          },
        },
      });

      await tx.lockOperation.update({
        where: { id: op.id },
        data: { commandId: command.id },
      });

      return op;
    });

    return operation;
  }
};
