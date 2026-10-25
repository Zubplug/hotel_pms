'use server';

import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

export async function saveOrganizationDiscount(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const targetType = String(formData.get('targetType') || '');
  const targetId = String(formData.get('targetId') || '');
  const percentage = Number(formData.get('percentage'));
  const reason = String(formData.get('reason') || '').trim() || null;
  if (!organizationId || !targetId || !['PLAN', 'ADDON'].includes(targetType) || !Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) throw new Error('Enter a valid discount between 0.01% and 99.99%.');

  const [organization, target] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
    targetType === 'PLAN'
      ? prisma.billingPlan.findUnique({ where: { id: targetId }, select: { id: true } })
      : prisma.billingProduct.findUnique({ where: { id: targetId, type: 'ADDON' }, select: { id: true } }),
  ]);
  if (!organization || !target) throw new Error('The selected organisation or billing target was not found.');

  await prisma.$transaction(async (tx) => {
    await tx.organizationBillingDiscount.updateMany({ where: { organizationId, ...(targetType === 'PLAN' ? { planId: targetId } : { productId: targetId }), active: true }, data: { active: false, endsAt: new Date() } });
    await tx.organizationBillingDiscount.create({ data: { organizationId, ...(targetType === 'PLAN' ? { planId: targetId } : { productId: targetId }), percentage, reason, createdByUserId: admin.id } });
    await tx.auditLog.create({ data: { organizationId, userId: admin.id, userEmail: admin.email || undefined, action: 'BILLING_DISCOUNT_SET', resource: targetType === 'PLAN' ? 'BillingPlan' : 'BillingProduct', resourceId: targetId, requestId: `hq-discount-${Date.now()}`, newValue: { targetType, percentage, reason } } });
  });
  revalidatePath('/hq/organizations');
  revalidatePath(`/hq/organizations/${organizationId}`);
}
