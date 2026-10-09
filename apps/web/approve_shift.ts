import prisma from '@hotel-pms/db';

async function main() {
  const res = await prisma.posSession.update({
    where: { id: "cbeb420e-69d1-4562-aaa9-03f85558a503" },
    data: {
      controlStatus: 'RECONCILED',
      approvalDecision: 'APPROVED',
      approvedAt: new Date(),
    }
  });
  console.log("Approved session:", res.id);
  
  // also update POS operator session if needed, but posSession is the main one sync checks
}
main();
