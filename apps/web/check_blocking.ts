import prisma from '@hotel-pms/db';

async function main() {
  const sessions = await prisma.posSession.findMany({
    where: { 
      propertyId: "9b8a4229-4059-42f4-9565-51cfdbe79046",
      AND: [
        {
          OR: [
            { controlStatus: "SUBMITTED" },
            { controlStatus: "UNDER_REVIEW" },
            { controlStatus: "RETURNED" },
            { controlStatus: "HANDOVER_PENDING" },
            { 
              controlStatus: null, 
              OR: [
                { status: "RECONCILIATION_REQUIRED" },
                { status: "CLOSING" }
              ]
            }
          ]
        },
        {
          OR: [
             { approvalDecision: null },
             { approvalDecision: { notIn: ["APPROVED", "APPROVED_WITH_VARIANCE"] } }
          ]
        }
      ]
    }
  });
  
  console.log("Blocking sessions found:", sessions.length);
  for (const s of sessions) {
     console.log(s.id, s.primaryOperatorId, s.outletId, s.status, s.controlStatus, s.approvalDecision);
  }
}
main();
