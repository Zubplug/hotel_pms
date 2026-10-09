'use server';

import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';

type Result = { ok: true } | { ok: false; error: string };

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
