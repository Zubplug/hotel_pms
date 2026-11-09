'use server';

import prisma from '@hotel-pms/db';
import { requireHQAdmin } from '@/lib/auth/hq';
import { revalidatePath } from 'next/cache';

export async function createDemoUserFromHQ(formData: FormData) {
  await requireHQAdmin();
  const firstName = String(formData.get('firstName') || '').trim();
  const lastName = String(formData.get('lastName') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const roleName = String(formData.get('roleName') || '').trim();
  if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !['GENERAL_MANAGER', 'FRONT_DESK', 'HR_MANAGER', 'STOCK_MANAGER', 'GENERAL_CASHIER', 'NIGHT_AUDITOR', 'ACCOUNTANT', 'FNB_MANAGER'].includes(roleName)) throw new Error('Complete the demo user details and select a valid role.');

  const websiteOrigin = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app';
  const response = await fetch(`${websiteOrigin.replace(/\/$/, '')}/api/demo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': 'hq-admin' },
    body: JSON.stringify({ firstName, lastName, email, roleName, website: '', consent: true }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to create the demo user.');
  revalidatePath('/hq/demo');
  return body;
}

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
