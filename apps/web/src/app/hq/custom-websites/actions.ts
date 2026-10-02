'use server';

import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

type Result = { ok: true } | { ok: false; error: string };

export async function approveCustomWebsiteRequest(id: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    const price = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_CUSTOM_WEBSITE_DESIGN', active: true }, interval: 'one_time' }, orderBy: { amount: 'asc' }, select: { id: true, amount: true, currency: true } });
    if (!price) throw new Error('Create an active one-time price for ADDON_CUSTOM_WEBSITE_DESIGN first.');
    await prisma.customWebsiteRequest.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'APPROVED', billingPriceId: price.id, amount: price.amount, currency: price.currency, reviewedBy: admin.email, reviewedAt: new Date() } });
    revalidatePath('/hq/custom-websites');
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Approval failed' }; }
}

export async function rejectCustomWebsiteRequest(id: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    await prisma.customWebsiteRequest.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'REJECTED', reviewedBy: admin.email, reviewedAt: new Date() } });
    revalidatePath('/hq/custom-websites');
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Rejection failed' }; }
}

export async function startCustomWebsiteRequest(id: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    await prisma.customWebsiteRequest.updateMany({ where: { id, status: 'PAID' }, data: { status: 'IN_PROGRESS', activatedAt: new Date(), reviewedBy: admin.email } });
    revalidatePath('/hq/custom-websites');
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Project start failed' }; }
}
