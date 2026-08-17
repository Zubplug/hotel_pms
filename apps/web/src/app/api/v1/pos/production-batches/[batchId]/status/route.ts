import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { PosProductionBatchStatus } from '@hotel-pms/db';

// Valid status transitions (forward only)
const STATUS_ORDER: PosProductionBatchStatus[] = [
  'PENDING',
  'ACKNOWLEDGED',
  'PREPARING',
  'READY',
  'COMPLETED',
];

// PATCH /api/v1/pos/production-batches/[batchId]/status
// Updates batch status, enforcing forward-only transitions.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const body = await req.json();
    const { status: newStatus } = body as { status: PosProductionBatchStatus };

    if (!STATUS_ORDER.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${STATUS_ORDER.join(', ')}` },
        { status: 400 }
      );
    }

    const batch = await prisma.posProductionBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const currentIndex = STATUS_ORDER.indexOf(batch.status as PosProductionBatchStatus);
    const newIndex = STATUS_ORDER.indexOf(newStatus);

    if (newIndex <= currentIndex) {
      return NextResponse.json(
        { error: `Cannot transition from ${batch.status} to ${newStatus}. Status can only advance forward.` },
        { status: 400 }
      );
    }

    const updated = await prisma.posProductionBatch.update({
      where: { id: batchId },
      data: { status: newStatus },
      include: {
        items: true,
        order: { select: { id: true, orderNumber: true, tableNumber: true } },
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (err: any) {
    console.error('[PATCH /api/v1/pos/production-batches/[batchId]/status]', err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
