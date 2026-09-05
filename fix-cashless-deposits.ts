import prisma from './packages/db/src/index.js'; // Note: Adjust the import if needed for your workspace

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  
  console.log('Finding cashless deposits (expectedAmount = 0) that are pending...');
  
  const deposits = await db.bankDeposit.findMany({
    where: {
      expectedAmount: 0,
      status: { notIn: ['RECONCILED', 'DEPOSITED'] }
    },
    include: {
      allocations: true
    }
  });

  console.log(`Found ${deposits.length} pending cashless deposits.`);

  for (const dep of deposits) {
    console.log(`Fixing deposit ${dep.id} (Ref: ${dep.depositReference})`);
    
    // Mark the deposit as RECONCILED
    await db.bankDeposit.update({
      where: { id: dep.id },
      data: {
        status: 'RECONCILED',
        bankConfirmedAmount: 0,
        difference: 0,
        reconciledAt: new Date(),
        notes: (dep.notes ? dep.notes + '\n' : '') + '[Auto-fix]: Automatically reconciled ₦0 deposit.'
      }
    });

    // Mark the associated shifts as RECONCILED
    for (const alloc of dep.allocations) {
      if (alloc.posSessionId) {
        await db.posSession.update({
          where: { id: alloc.posSessionId },
          data: { controlStatus: 'RECONCILED' }
        });
      }
      if (alloc.frontdeskSessionId) {
        await db.frontdeskSession.update({
          where: { id: alloc.frontdeskSessionId },
          data: { status: 'RECONCILED', controlStatus: 'RECONCILED' }
        });
      }
    }
  }

  // Also check if there are pending handovers with 0 amount
  console.log('Finding cashless handovers (amount = 0) that are pending...');
  const handovers = await db.cashHandover.findMany({
    where: {
      amount: 0,
      status: 'PENDING'
    },
    include: {
      posSessions: true,
      frontdeskSessions: true
    }
  });
  
  console.log(`Found ${handovers.length} pending cashless handovers.`);
  for (const ho of handovers) {
    console.log(`Fixing handover ${ho.id} (Ref: ${ho.handoverReference})`);
    
    // Mark handover as COMPLETED (and bypass deposit)
    await db.cashHandover.update({
      where: { id: ho.id },
      data: {
        status: 'COMPLETED',
        notes: (ho.notes ? ho.notes + '\n' : '') + '[Auto-fix]: Automatically completed ₦0 handover.'
      }
    });
    
    for (const s of ho.posSessions) {
      await db.posSession.update({
         where: { id: s.id },
         data: { controlStatus: 'RECONCILED' }
      });
    }
    for (const s of ho.frontdeskSessions) {
      await db.frontdeskSession.update({
         where: { id: s.id },
         data: { status: 'RECONCILED', controlStatus: 'RECONCILED' }
      });
    }
  }

  console.log('Done.');
  await db.$disconnect();
}

main().catch(console.error);
