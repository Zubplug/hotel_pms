import prisma from '@hotel-pms/db';

async function main() {
  const sessions = await prisma.posSession.findMany({
    where: { 
      propertyId: "9b8a4229-4059-42f4-9565-51cfdbe79046",
      primaryOperatorId: "c7308ec0-4ea8-4ba1-914b-6963eca06dbc"
    }
  });
  
  for (const s of sessions) {
     console.log(s.id, s.status, s.controlStatus, s.approvalDecision);
  }
}
main();
