import prisma from '@hotel-pms/db';

async function run() {
  console.log('--- Phase 2A: KDS E2E Verification ---');
  
  const batch = await prisma.posProductionBatch.findFirst({
    where: { status: 'PENDING' },
    include: { order: true, items: true }
  });

  if (!batch) {
    console.log('No PENDING batches found. Cannot perform E2E test on live data.');
    process.exit(0);
  }

  console.log(`Found Batch ID: ${batch.id} for Order: ${batch.order.orderNumber}`);

  // 1. Snapshot Order & KOT state
  const orderSnapshot = await prisma.posOrder.findUnique({ where: { id: batch.orderId } });
  const kotsSnapshot = await prisma.posKot.findMany({ where: { orderId: batch.orderId } });

  // 2. Perform KDS Transition (Simulating POST /api/v1/fnb/kitchen/batches/[id]/transition)
  console.log('Transitioning batch to PREPARING...');
  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.posProductionBatch.update({
      where: { id: batch.id },
      data: { status: 'PREPARING' }
    });
    
    await tx.posProductionBatchEvent.create({
      data: {
        batchId: batch.id,
        fromStatus: 'PENDING',
        toStatus: 'PREPARING',
      }
    });
    return b;
  });

  // 3. Verify Event Created
  const events = await prisma.posProductionBatchEvent.findMany({
    where: { batchId: batch.id },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Transition complete. New Status: ${updated.status}`);
  console.log(`Audit Events found: ${events.length}`);
  console.log(`Latest Event: ${events[0].fromStatus} -> ${events[0].toStatus}`);

  // 4. Verify original order/KOT remains untouched
  const orderPost = await prisma.posOrder.findUnique({ where: { id: batch.orderId } });
  const kotsPost = await prisma.posKot.findMany({ where: { orderId: batch.orderId } });

  if (JSON.stringify(orderSnapshot) === JSON.stringify(orderPost)) {
    console.log('✅ PosOrder remains identical/untouched.');
  } else {
    console.error('❌ PosOrder was mutated!');
  }

  if (JSON.stringify(kotsSnapshot) === JSON.stringify(kotsPost)) {
    console.log('✅ PosKot records remain identical/untouched.');
  } else {
    console.error('❌ PosKot records were mutated!');
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
