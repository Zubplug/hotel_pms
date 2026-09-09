import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Connecting to production DB...");
  const recentRoomsWithDiscount = await prisma.reservationRoom.findMany({
    where: {
      discountType: { not: null }
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      reservation: { select: { confirmationNumber: true, property: { select: { name: true } } } }
    }
  });

  console.log("Recent 5 ReservationRooms with Discount:");
  for (const r of recentRoomsWithDiscount) {
    console.log(`- Res: ${r.reservation.confirmationNumber} | Discount: ${r.discountType} ${r.discountAmount} | Approval ID: ${r.discountApprovalId}`);
    
    if (r.discountApprovalId) {
      const approval = await prisma.approvalRequest.findUnique({
        where: { id: r.discountApprovalId }
      });
      console.log(`  -> ApprovalRequest found? ${!!approval}`);
      if (approval) {
         console.log(`     Status: ${approval.status}, Type: ${approval.type}, Amount: ${approval.amount}`);
      }
    }
  }

  // Find latest approval requests of type DISCOUNT
  const recentApprovals = await prisma.approvalRequest.findMany({
    where: { type: 'DISCOUNT' },
    orderBy: { requestedAt: 'desc' },
    take: 2
  });
  console.log("\nRecent 2 ApprovalRequests (DISCOUNT):");
  for (const a of recentApprovals) {
    console.log(`- ID: ${a.id} | Status: ${a.status} | Amount: ${a.amount} | Reason: ${a.reason}`);
  }
}

main().then(() => {
  console.log("Done");
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
