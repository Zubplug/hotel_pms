'use server';

import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

type Result = { ok: true } | { ok: false; error: string };

export async function approveCustomDomainRequest(id: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    const price = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_CUSTOM_DOMAIN', active: true }, interval: 'month' }, orderBy: { amount: 'asc' }, select: { id: true, amount: true, currency: true } });
    if (!price) throw new Error('Create an active monthly price for ADDON_CUSTOM_DOMAIN first.');
    await prisma.customDomainRequest.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'APPROVED', billingPriceId: price.id, amount: price.amount, currency: price.currency, reviewedBy: admin.email, reviewedAt: new Date() } });
    revalidatePath('/hq/custom-domains');
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Approval failed' }; }
}

export async function rejectCustomDomainRequest(id: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    await prisma.customDomainRequest.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'REJECTED', reviewedBy: admin.email, reviewedAt: new Date() } });
    revalidatePath('/hq/custom-domains');
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Rejection failed' }; }
}

export async function activateCustomDomainRequest(id: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    const request = await prisma.customDomainRequest.findUnique({ where: { id }, select: { organizationId: true, propertyId: true, status: true } });
    if (!request || request.status !== 'PAID') throw new Error('A paid request is required before activation.');
    const entitlement = await prisma.entitlement.findFirst({ where: { organizationId: request.organizationId, propertyId: request.propertyId, productCode: 'ADDON_CUSTOM_DOMAIN', status: 'ACTIVE' }, select: { id: true } });
    if (!entitlement) throw new Error('Payment received, but the custom-domain entitlement has not been reconciled yet.');
    await prisma.customDomainRequest.update({ where: { id }, data: { status: 'ACTIVE', activatedAt: new Date(), reviewedBy: admin.email } });
    revalidatePath('/hq/custom-domains');
    revalidatePath(`/portal/settings/booking-engine/${request.propertyId}`);
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Activation failed' }; }
}
