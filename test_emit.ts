import { NotificationEngine } from './apps/web/src/lib/notification-engine';

async function main() {
  await NotificationEngine.emit({
    type: 'RESERVATION_CANCELLED',
    organizationId: 'd08a652f-344b-4749-8dd6-09e63cb9740e',
    propertyId: '9b8a4229-4059-42f4-9565-51cfdbe79046',
    entityType: 'reservation',
    entityId: 'e11551ac-54b0-4d99-a6e0-ca27aa25bfa7', // invalid ID but should not crash completely
    idempotencyKey: 'test_cxl_123',
  });
  console.log('done');
}
main().catch(console.error);
