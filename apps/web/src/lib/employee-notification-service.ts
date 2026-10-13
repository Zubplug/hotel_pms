import prisma from '@hotel-pms/db';

export async function notifyEmployee(input: { organizationId: string; propertyId?: string; staffId: string; subject: string; body: string; category?: string; action?: string; idempotencyKey?: string }) {
  if (input.idempotencyKey) {
    const existing = await prisma.notification.findFirst({ where: { recipientType: 'staff', recipientId: input.staffId, groupKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  return prisma.notification.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, recipientType: 'staff', recipientId: input.staffId, channel: 'in_app', status: 'sent', subject: input.subject, body: input.body, category: input.category || 'APPROVALS', priority: 'P2', action: input.action, groupKey: input.idempotencyKey } });
}
