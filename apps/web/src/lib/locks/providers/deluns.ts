import prisma from '@hotel-pms/db';
import { IssueCredentialParams } from '../orchestrator';

export const delunsLockProvider = {
  async issueCredential(params: IssueCredentialParams, agentId: string) {
    const {
      reservationId, guestId, roomId, lockId, propertyId,
      type, validFrom, validUntil, idempotencyKey
    } = params;

    // 1. Validate Deluns Configuration on the Property
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) throw new Error('Property not found');
    
    // Validate lockConfiguration
    const lockConfig = property.lockConfiguration as { provider?: string; dlsCoID?: number } | null;
    if (!lockConfig || lockConfig.provider !== 'DELUNS') {
      throw new Error('Property is not configured for DELUNS lock provider');
    }
    
    const dlsCoID = lockConfig.dlsCoID;
    if (dlsCoID === undefined) {
      throw new Error('Deluns Hotel Code (dlsCoID) is missing from property configuration');
    }

    // 2. Fetch the door lock to get the specific lock code
    const doorLock = await prisma.doorLock.findUnique({ where: { id: lockId } });
    if (!doorLock) throw new Error('DoorLock not found');

    const lockCode = doorLock.lockCode; // This is the roomNo for Deluns

    // 3. Create all records in a single transaction
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

      // Serialize the specific Deluns payload
      const command = await tx.lockCommand.create({
        data: {
          operationId: op.id,
          agentId,
          commandType: 'ENCODE_CARD',
          status: 'QUEUED',
          payload: {
            operationId: op.id,
            credentialId: credential.id,
            dlsCoID,
            lockCode,
            bDate: validFrom.toISOString(),
            eDate: validUntil.toISOString(),
            type,
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
