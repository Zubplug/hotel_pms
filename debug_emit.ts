import { NotificationEngine } from './apps/web/src/lib/notification-engine';
import prisma from './packages/db/src/index';

async function main() {
  const reservation = await prisma.reservation.findFirst({
    include: { property: true }
  });
  
  if (!reservation) {
    console.log('No reservations found to test with.');
    return;
  }
  
  console.log(`Testing emit for reservation ${reservation.id}`);
  console.log(`Org: ${reservation.property.organizationId}, Prop: ${reservation.propertyId}`);
  
  // Try emitting
  try {
    await NotificationEngine.emit({
      type: 'RESERVATION_CANCELLED',
      organizationId: reservation.property.organizationId,
      propertyId: reservation.propertyId,
      entityType: 'reservation',
      entityId: reservation.id,
      idempotencyKey: `test_${Date.now()}`,
    });
    console.log('Emit call completed');
  } catch (err) {
    console.error('Emit threw:', err);
  }
}

main().catch(console.error);
