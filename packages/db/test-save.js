const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log('No org');
      return;
    }
    await prisma.notification.createMany({
      data: [{
        organizationId: org.id,
        propertyId: null,
        recipientType: 'staff',
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'sent',
        channel: 'in_app',
        subject: 'Test',
        body: 'Test Body',
        category: 'Finance',
        priority: 'Normal',
        action: `/test/123`,
        metadata: {},
      }]
    });
    console.log('Saved successfully!');
  } catch (err) {
    console.error('Save failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
