const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  
  const posKots = await prisma.posKot.findMany({ 
      where: { order: { propertyId } }, 
      select: { status: true, printStatus: true } 
  });
  console.log("PosKot statuses:", [...new Set(posKots.map(r => r.status))]);
  console.log("PosKot printStatuses:", [...new Set(posKots.map(r => r.printStatus))]);

  const posChecks = await prisma.posCheck.findMany({ 
      where: { order: { propertyId } }, 
      select: { status: true } 
  });
  console.log("PosCheck statuses:", [...new Set(posChecks.map(r => r.status))]);

  const posPayments = await prisma.posPayment.findMany({ 
      where: { order: { propertyId } }, 
      select: { status: true } 
  });
  console.log("PosPayment statuses:", [...new Set(posPayments.map(r => r.status))]);
  
  const refundReqs = await prisma.refundRequest.findMany({ 
      where: { propertyId }, 
      select: { status: true } 
  });
  console.log("RefundRequest statuses:", [...new Set(refundReqs.map(r => r.status))]);

  const frontdeskS = await prisma.frontdeskSession.findMany({ 
      where: { propertyId }, 
      select: { status: true, controlStatus: true, varianceStatus: true } 
  });
  console.log("FrontdeskSession statuses:", [...new Set(frontdeskS.map(r => r.status))]);
  console.log("FrontdeskSession controlStatus:", [...new Set(frontdeskS.map(r => r.controlStatus))]);
  console.log("FrontdeskSession varianceStatus:", [...new Set(frontdeskS.map(r => r.varianceStatus))]);
  
  const posS = await prisma.posSession.findMany({ 
      where: { propertyId }, 
      select: { controlStatus: true, varianceStatus: true } 
  });
  console.log("PosSession controlStatus:", [...new Set(posS.map(r => r.controlStatus))]);
  console.log("PosSession varianceStatus:", [...new Set(posS.map(r => r.varianceStatus))]);

}
run().catch(console.error).finally(() => prisma.$disconnect());
