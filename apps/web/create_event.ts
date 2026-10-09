import prisma from '@hotel-pms/db';

async function main() {
  const session = await prisma.posSession.findUnique({
    where: { id: "cbeb420e-69d1-4562-aaa9-03f85558a503" }
  });
  
  if (session) {
    const payload = {
      id: session.id,
      propertyId: session.propertyId,
      status: "CLOSED",
      controlStatus: "RECONCILED",
      approvalDecision: "APPROVED",
      updatedAt: new Date().toISOString()
    };

    const evt = await prisma.hotelEvent.create({
      data: {
        propertyId: session.propertyId,
        idempotencyKey: `op_force_approve_${session.id}_${Date.now()}_2`,
        aggregateType: "POS_SESSION",
        aggregateId: session.id,
        aggregateVersion: 2, 
        eventType: "POS_SESSION_UPDATED",
        occurredAt: new Date(),
        payload: payload,
        deviceId: session.deviceId || "UNKNOWN",
        operatorId: session.primaryOperatorId || "UNKNOWN"
      }
    });
    console.log("Created event:", evt.id);
  }
}
main();
