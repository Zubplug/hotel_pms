import prisma from '@hotel-pms/db';

const MANAGER_POSITION = /(manager|director|head|chief|general manager|supervisor)/i;

export async function createAccountDeletionRequest(input: { propertyId: string; staffId: string; fullName: string; email: string; reason?: string; source: 'MOBILE_APP' | 'WEB' }) {
  const property = await prisma.property.findUnique({ where: { id: input.propertyId }, select: { id: true, name: true, organizationId: true } });
  if (!property) throw new Error('PROPERTY_NOT_FOUND');
  const staff = await prisma.staff.findFirst({ where: { id: input.staffId, propertyAccess: { has: input.propertyId }, isActive: true }, select: { id: true } });
  if (!staff) throw new Error('STAFF_NOT_FOUND');
  const existing = await prisma.approvalRequest.findFirst({ where: { propertyId: input.propertyId, requestedBy: staff.id, type: 'ACCOUNT_DELETION', status: 'PENDING' }, select: { id: true, status: true, createdAt: true } });
  if (existing) return { request: existing, duplicate: true, managerCount: 0 };
  const request = await prisma.approvalRequest.create({ data: { propertyId: property.id, type: 'ACCOUNT_DELETION', status: 'PENDING', requestedBy: staff.id, reason: input.reason?.trim() || 'User requested deletion of their LodgeCore Management account.', details: { source: input.source, fullName: input.fullName.trim(), email: input.email.trim().toLowerCase(), stage: 'PROPERTY_MANAGER_REVIEW', deletionStatus: 'NOT_STARTED', notice: 'Approval only; no data has been deleted.' }, snapshot: { fullName: input.fullName.trim(), email: input.email.trim().toLowerCase(), propertyId: property.id, propertyName: property.name, requestedAt: new Date().toISOString() }, idempotencyKey: 'ACCOUNT_DELETION:' + property.id + ':' + staff.id } });
  const managers = await prisma.staff.findMany({ where: { propertyAccess: { has: property.id }, organizationId: property.organizationId, isActive: true, id: { not: staff.id } }, select: { id: true, position: true } });
  const recipients = managers.filter((manager) => MANAGER_POSITION.test(manager.position));
  await Promise.all(recipients.map(async (manager) => {
    const groupKey = 'ACCOUNT_DELETION_NOTIFY:' + request.id + ':' + manager.id;
    const existingNotification = await prisma.notification.findFirst({ where: { recipientType: 'staff', recipientId: manager.id, groupKey } });
    if (!existingNotification) await prisma.notification.create({ data: { organizationId: property.organizationId, propertyId: property.id, recipientType: 'staff', recipientId: manager.id, channel: 'in_app', status: 'sent', subject: 'Account deletion request requires review', body: input.fullName + ' requested deletion of their LodgeCore Management account for ' + property.name + '. Review the ACCOUNT_DELETION approval request. No data has been deleted.', category: 'APPROVALS', priority: 'P2', action: '/manager/approvals/' + request.id, groupKey } });
  }));
  return { request, duplicate: false, managerCount: recipients.length };
}
