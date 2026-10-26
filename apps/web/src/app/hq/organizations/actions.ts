'use server';

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';
import { sendCustomerInvitationEmail } from '@/lib/email/send-customer-invitation';
import { activateTrial } from '@hotel-pms/db';

export async function activateOrganizationTrial(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const planCode = String(formData.get('planCode') || 'ESSENTIAL').trim().toUpperCase();
  if (!organizationId || !planCode) throw new Error('Select an organisation and trial plan.');

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!organization) throw new Error('Organisation not found.');

  const subscription = await activateTrial(prisma, { organizationId, planCode, source: 'HQ_ADMIN' });
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId: admin.id,
      userEmail: admin.email || undefined,
      action: 'ORGANIZATION_TRIAL_ACTIVATED',
      resource: 'Subscription',
      resourceId: subscription.id,
      requestId: `hq-trial-${Date.now()}`,
      newValue: { planCode, source: 'HQ_ADMIN' },
    },
  });
  revalidatePath('/hq/organizations');
  revalidatePath(`/hq/organizations/${organizationId}`);
}

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

export async function removeOrganizationDiscount(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const discountId = String(formData.get('discountId') || '');
  if (!organizationId || !discountId) throw new Error('Organisation discount could not be identified.');

  const discount = await prisma.organizationBillingDiscount.findFirst({
    where: { id: discountId, organizationId, active: true },
    select: { id: true, planId: true, productId: true, percentage: true },
  });
  if (!discount) throw new Error('Active organisation discount not found.');

  await prisma.$transaction(async (tx) => {
    await tx.organizationBillingDiscount.update({ where: { id: discount.id }, data: { active: false, endsAt: new Date() } });
    await tx.auditLog.create({
      data: {
        organizationId,
        userId: admin.id,
        userEmail: admin.email || undefined,
        action: 'BILLING_DISCOUNT_REMOVED',
        resource: discount.planId ? 'BillingPlan' : 'BillingProduct',
        resourceId: discount.planId ?? discount.productId ?? discount.id,
        requestId: `hq-discount-remove-${Date.now()}`,
        newValue: { discountId: discount.id, percentage: Number(discount.percentage), planId: discount.planId, productId: discount.productId },
      },
    });
  });
  revalidatePath('/hq/organizations');
  revalidatePath(`/hq/organizations/${organizationId}`);
}

export async function updateOrganization(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const name = String(formData.get('name') || '').trim();
  const slug = String(formData.get('slug') || '').trim().toLowerCase();
  const defaultCurrency = String(formData.get('defaultCurrency') || '').trim().toUpperCase();
  const defaultTimezone = String(formData.get('defaultTimezone') || '').trim();
  if (!organizationId || !name || !slug || !defaultCurrency || !defaultTimezone) throw new Error('Complete all organisation details.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Use lowercase letters, numbers and hyphens for the slug.');
  await prisma.organization.update({ where: { id: organizationId }, data: { name, slug, defaultCurrency, defaultTimezone } });
  await prisma.auditLog.create({ data: { organizationId, userId: admin.id, userEmail: admin.email || undefined, action: 'ORGANIZATION_UPDATED', resource: 'Organization', resourceId: organizationId, requestId: `hq-organization-${Date.now()}`, newValue: { name, slug, defaultCurrency, defaultTimezone } } });
  revalidatePath('/hq/organizations');
  revalidatePath(`/hq/organizations/${organizationId}`);
}

export async function updateOrganizationProperty(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const propertyId = String(formData.get('propertyId') || '');
  const name = String(formData.get('name') || '').trim();
  const city = String(formData.get('city') || '').trim();
  const country = String(formData.get('country') || '').trim();
  const isActive = String(formData.get('isActive')) === 'true';
  if (!organizationId || !propertyId || !name || !city || !country) throw new Error('Complete all property details.');
  const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId }, select: { id: true } });
  if (!property) throw new Error('Property not found for this organisation.');
  await prisma.property.update({ where: { id: propertyId }, data: { name, city, country, isActive, suspendedAt: isActive ? null : new Date() } });
  await prisma.auditLog.create({ data: { organizationId, userId: admin.id, userEmail: admin.email || undefined, action: 'PROPERTY_UPDATED', resource: 'Property', resourceId: propertyId, requestId: `hq-property-${Date.now()}`, newValue: { name, city, country, isActive } } });
  revalidatePath('/hq/organizations');
  revalidatePath(`/hq/organizations/${organizationId}`);
}

export async function addOrganizationProperty(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const name = String(formData.get('name') || '').trim();
  const address = String(formData.get('address') || '').trim();
  const city = String(formData.get('city') || '').trim();
  const state = String(formData.get('state') || '').trim();
  const country = String(formData.get('country') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const website = String(formData.get('website') || '').trim() || null;
  const baseCurrency = String(formData.get('baseCurrency') || 'NGN').trim().toUpperCase();
  const timezone = String(formData.get('timezone') || 'Africa/Lagos').trim();
  if (!organizationId || !name || !address || !city || !state || !country || !phone || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Complete all required property details.');

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, defaultCurrency: true, defaultTimezone: true } });
    if (!organization) throw new Error('Organisation not found.');
    const existingProperty = await tx.property.findFirst({ where: { organizationId }, select: { id: true } });
    if (existingProperty) throw new Error('This organisation already has a property.');
    const currency = baseCurrency || organization.defaultCurrency;
    const property = await tx.property.create({ data: { organizationId, name, code: `PROP-${randomUUID().slice(0, 8).toUpperCase()}`, address, city, state, country, phone, email, website, baseCurrency: currency, supportedCurrencies: [currency], timezone: timezone || organization.defaultTimezone, businessDate: new Date(), auditStatus: 'OPEN', settings: { onboarding: { needsCompletion: false, source: 'HQ_MANUAL_CREATION' } } } });
    await tx.auditLog.create({ data: { organizationId, userId: admin.id, userEmail: admin.email || undefined, action: 'PROPERTY_CREATED', resource: 'Property', resourceId: property.id, requestId: `hq-property-create-${Date.now()}`, newValue: { name, city, state, country, baseCurrency: currency } } });
  });
  revalidatePath('/hq/organizations');
  revalidatePath(`/hq/organizations/${organizationId}`);
}

export async function inviteOrganizationPortalUser(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const firstName = String(formData.get('firstName') || '').trim() || null;
  const lastName = String(formData.get('lastName') || '').trim() || null;
  if (!organizationId || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid portal user email.');

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, portalOwnerUserId: true, portalOwner: { select: { email: true, emailVerifiedAt: true } } } });
  if (!organization) throw new Error('Organisation not found.');
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const currentOwner = await tx.organization.findUnique({ where: { id: organizationId }, select: { portalOwnerUserId: true, portalOwner: { select: { email: true, emailVerifiedAt: true } } } });
    if (currentOwner?.portalOwner?.emailVerifiedAt) throw new Error('This organisation already has an active verified portal user. Edit that user instead.');
    if (currentOwner?.portalOwner && currentOwner.portalOwner.email !== email) throw new Error('Only one portal user is allowed for an organisation. Use the existing portal user email.');
    const existing = await tx.user.findUnique({ where: { email }, include: { membership: true } });
    if (existing?.isLodgeCoreAdmin || existing?.isSuperAdmin) throw new Error('LodgeCore administrator accounts cannot be invited as customer portal users.');
    if (existing?.membership && existing.membership.organizationId !== organizationId) throw new Error('This email already belongs to another organisation.');
    if (existing?.membership && existing.membership.organizationId === organizationId && existing.membership.role !== 'OWNER') throw new Error('This email already belongs to an organisation staff account. Use another portal email.');
    const account = existing || await tx.user.create({ data: { email, firstName, lastName, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) } });
    await tx.organizationMembership.upsert({ where: { userId: account.id }, update: { organizationId, status: 'ACTIVE', role: existing?.membership?.role || 'OWNER' }, create: { userId: account.id, organizationId, status: 'ACTIVE', role: 'OWNER' } });
    await tx.organization.update({ where: { id: organizationId }, data: { portalOwnerUserId: account.id } });
    await tx.customerInvitation.updateMany({ where: { email, organizationId, acceptedAt: null }, data: { expiresAt: new Date() } });
    await tx.customerInvitation.create({ data: { email, organizationId, userId: account.id, tokenHash, expiresAt, createdById: admin.id } });
    await tx.auditLog.create({ data: { organizationId, userId: admin.id, userEmail: admin.email || undefined, action: 'CUSTOMER_PORTAL_INVITED', resource: 'CustomerInvitation', resourceId: tokenHash, requestId: `hq-portal-invite-${Date.now()}`, newValue: { email, userId: account.id } } });
  });
  const websiteOrigin = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app';
  await sendCustomerInvitationEmail({ to: email, inviteUrl: `${websiteOrigin}/portal/invite/${rawToken}`, expiresAt, organizationName: organization.name });
  revalidatePath(`/hq/organizations/${organizationId}`);
}

export async function updateOrganizationPortalUser(formData: FormData) {
  const admin = await requireHQAdmin();
  const organizationId = String(formData.get('organizationId') || '');
  const userId = String(formData.get('userId') || '');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const firstName = String(formData.get('firstName') || '').trim() || null;
  const lastName = String(formData.get('lastName') || '').trim() || null;
  if (!organizationId || !userId || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter valid portal user information.');
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { portalOwnerUserId: true } });
  if (!organization || organization.portalOwnerUserId !== userId) throw new Error('Portal user not found for this organisation.');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) throw new Error('Portal user not found.');
  const duplicate = await prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
  if (duplicate) throw new Error('That email address is already in use.');
  const emailChanged = user.email !== email;
  await prisma.user.update({ where: { id: userId }, data: { email, firstName, lastName, ...(emailChanged ? { emailVerifiedAt: null } : {}) } });
  await prisma.auditLog.create({ data: { organizationId, userId: admin.id, userEmail: admin.email || undefined, action: 'CUSTOMER_PORTAL_USER_UPDATED', resource: 'User', resourceId: userId, requestId: `hq-portal-user-${Date.now()}`, newValue: { email, firstName, lastName, emailChanged } } });
  revalidatePath(`/hq/organizations/${organizationId}`);
}
