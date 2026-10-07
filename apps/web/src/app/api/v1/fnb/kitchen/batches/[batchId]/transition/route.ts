import { NextResponse } from 'next/server';
import prisma, { PosProductionBatchStatus } from '@hotel-pms/db';
import { auth } from '@/lib/auth';

const KITCHEN_ROLES = ['KITCHEN_STAFF', 'CHEF', 'HEAD_CHEF', 'KITCHEN_MANAGER', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'ADMIN', 'DIRECTOR'];

const ALLOWED_TRANSITIONS: Record<PosProductionBatchStatus, PosProductionBatchStatus[]> = {
  PENDING: ['PREPARING', 'COMPLETED'],
  PREPARING: ['READY', 'COMPLETED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  ACKNOWLEDGED: ['PREPARING', 'COMPLETED'],
  CANCELLED: [],
};

export async function POST(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user || (!KITCHEN_ROLES.includes(String(user.role || '').toUpperCase()) && !(user.capabilities || []).some((value: string) => value === 'ACCESS_KITCHEN' || value.startsWith('kitchen.')))) {
      return NextResponse.json({ success: false, error: { message: 'Kitchen access required' } }, { status: 403 });
    }
    const resolvedParams = await params;
    const { status: targetStatus, actorId = user.id } = await req.json();
    
    if (!targetStatus) {
      return NextResponse.json({ success: false, error: { message: 'Missing target status' } }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.posProductionBatch.findUnique({
        where: { id: resolvedParams.batchId }
      });

      if (!batch) throw new Error('Batch not found');
      if (batch.station !== 'KITCHEN') throw new Error('Only kitchen batches can be updated here');
      
      const currentStatus = batch.status;
      
      if (currentStatus === targetStatus) return batch; // Idempotent
      
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(targetStatus as PosProductionBatchStatus)) {
        throw new Error(`Invalid transition from ${currentStatus} to ${targetStatus}`);
      }

      const updated = await tx.posProductionBatch.update({
        where: { id: resolvedParams.batchId },
        data: { status: targetStatus as PosProductionBatchStatus }
      });

      await tx.posProductionBatchEvent.create({
        data: {
          batchId: resolvedParams.batchId,
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
