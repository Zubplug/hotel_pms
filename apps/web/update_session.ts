import prisma from '@hotel-pms/db';

async function main() {
  const session = await prisma.posSession.update({
    where: { id: "cbeb420e-69d1-4562-aaa9-03f85558a503" },
    data: {
      controlStatus: "RECONCILED",
      approvalDecision: "APPROVED",
      status: "CLOSED",
      updatedAt: new Date()
    }
  });
  
  console.log("Updated session:", session.id, session.controlStatus, session.approvalDecision);
}
main();
