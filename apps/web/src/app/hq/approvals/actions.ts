'use server';

import { randomUUID } from 'node:crypto';
import prisma, { getEffectiveLimit } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

type PropertyPayload = { name: string; address: string; city: string; state: string; country: string; phone: string; email?: string; website?: string | null };

export async function reviewOrganizationApproval(formData: FormData) {
  const admin = await requireHQAdmin();
  const requestId = String(formData.get('requestId') || '');
  const decision = String(formData.get('decision') || '').toUpperCase();
  const reviewNotes = String(formData.get('reviewNotes') || '').trim() || null;
  if (!requestId || !['APPROVED', 'REJECTED'].includes(decision)) throw new Error('Invalid approval decision.');

  await prisma.$transaction(async (tx) => {
    const request = await tx.organizationApprovalRequest.findUnique({ where: { id: requestId } });
    if (!request || request.type !== 'PROPERTY_CREATE') throw new Error('Approval request not found.');
    if (request.status !== 'PENDING') throw new Error('This request has already been reviewed.');
    if (decision === 'REJECTED') {
      await tx.organizationApprovalRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', reviewedById: admin.id, reviewedAt: new Date(), reviewNotes } });
    } else {
      const payload = request.payload as PropertyPayload;
      const organization = await tx.organization.findUnique({ where: { id: request.organizationId }, select: { id: true, defaultCurrency: true } });
      if (!organization) throw new Error('Organisation not found.');
      const limit = await getEffectiveLimit(prisma, { organizationId: organization.id, limit: 'maxProperties' });
      const activeCount = await tx.property.count({ where: { organizationId: organization.id, isActive: true } });
      if (limit !== null && activeCount + 1 > limit) throw new Error(`The organisation subscription allows ${limit} active propert${limit === 1 ? 'y' : 'ies'}.`);
      const existingProperty = await tx.property.findFirst({ where: { organizationId: organization.id }, select: { id: true } });
      if (existingProperty) throw new Error('The organisation already has a property.');
      const property = await tx.property.create({ data: { organizationId: organization.id, name: payload.name, code: `PROP-${randomUUID().slice(0, 8).toUpperCase()}`, address: payload.address, city: payload.city, state: payload.state, country: payload.country, phone: payload.phone, email: payload.email || '', website: payload.website || null, baseCurrency: organization.defaultCurrency, supportedCurrencies: [organization.defaultCurrency], businessDate: new Date(), auditStatus: 'OPEN', settings: { onboarding: { needsCompletion: false, source: 'PORTAL_PROPERTY_APPROVAL', approvalRequestId: request.id } } } });
      await tx.organizationApprovalRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', reviewedById: admin.id, reviewedAt: new Date(), reviewNotes } });
      await tx.auditLog.create({ data: { organizationId: organization.id, userId: admin.id, userEmail: admin.email || undefined, action: 'PROPERTY_APPROVAL_APPROVED', resource: 'Property', resourceId: property.id, requestId: `hq-property-approval-${request.id}`, newValue: { approvalRequestId: request.id, propertyId: property.id, reviewNotes } } });
    }
    await tx.auditLog.create({ data: { organizationId: request.organizationId, userId: admin.id, userEmail: admin.email || undefined, action: decision === 'APPROVED' ? 'ORGANIZATION_APPROVAL_APPROVED' : 'ORGANIZATION_APPROVAL_REJECTED', resource: 'OrganizationApprovalRequest', resourceId: request.id, requestId: `hq-approval-${request.id}-${decision}`, newValue: { type: request.type, decision, reviewNotes } } });
  });
  revalidatePath('/hq/approvals');
  revalidatePath('/hq/organizations');
}
