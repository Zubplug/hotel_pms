'use server';

import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { revalidatePath } from 'next/cache';

export async function saveDemoConfiguration(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '').trim();
  const propertyId = String(formData.get('propertyId') || '').trim();
  const grantorUserId = String(formData.get('grantorUserId') || '').trim();
  const enabled = formData.get('enabled') === 'on';

  if (!organizationId || !propertyId || !grantorUserId) throw new Error('Select an organization, property, and grantor user.');
  const [organization, property, grantor] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } }),
    prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, organizationId: true } }),
    prisma.user.findUnique({ where: { id: grantorUserId }, select: { id: true, isLodgeCoreAdmin: true, isSuperAdmin: true } }),
  ]);
  if (!organization || !property || property.organizationId !== organization.id) throw new Error('The selected property does not belong to the selected organization.');
  if (!grantor || (!grantor.isLodgeCoreAdmin && !grantor.isSuperAdmin)) throw new Error('The grantor must be an HQ administrator.');

  await (prisma as any).demoConfiguration.upsert({
    where: { configKey: 'default' },
    update: { enabled, organizationId, propertyId, grantorUserId, updatedById: admin.id },
    create: { configKey: 'default', enabled, organizationId, propertyId, grantorUserId, updatedById: admin.id },
  });
  revalidatePath('/hq/demo');
}
