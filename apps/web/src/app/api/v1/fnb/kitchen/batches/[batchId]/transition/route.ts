import { NextResponse } from 'next/server';
import prisma, { PosProductionBatchStatus } from '@hotel-pms/db';

const ALLOWED_TRANSITIONS: Record<PosProductionBatchStatus, PosProductionBatchStatus[]> = {
  PENDING: ['PREPARING', 'RECALLED', 'COMPLETED'], // sometimes skipped directly to completed
  PREPARING: ['READY', 'RECALLED', 'COMPLETED'],
  READY: ['COMPLETED', 'RECALLED'],
  COMPLETED: ['RECALLED'],
  RECALLED: ['PENDING', 'PREPARING'],
};

export async function POST(req: Request, { params }: { params: { batchId: string } }) {
  try {
    const { status: targetStatus, actorId } = await req.json();
    
    if (!targetStatus) {
      return NextResponse.json({ success: false, error: { message: 'Missing target status' } }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.posProductionBatch.findUnique({
        where: { id: params.batchId }
      });

      if (!batch) throw new Error('Batch not found');
      
      const currentStatus = batch.status;
      
      if (currentStatus === targetStatus) return batch; // Idempotent
      
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(targetStatus as PosProductionBatchStatus)) {
        throw new Error(`Invalid transition from ${currentStatus} to ${targetStatus}`);
      }

      const updated = await tx.posProductionBatch.update({
        where: { id: params.batchId },
        data: { status: targetStatus as PosProductionBatchStatus }
      });

      await tx.posProductionBatchEvent.create({
        data: {
          batchId: params.batchId,
          fromStatus: currentStatus,
          toStatus: targetStatus as PosProductionBatchStatus,
          actorId: actorId || null,
        }
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 400 });
  }
}
