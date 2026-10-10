'use server';

import prisma from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireHQAdmin } from '@/lib/auth/hq';
import crypto from 'node:crypto';

type Result = { ok: true } | { ok: false; error: string };

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function domainOrigins(domain: string) {
  return [`https://${domain}`, `https://www.${domain}`];
}

function createPublishableKey() {
  return `pk_live_${crypto.randomBytes(24).toString('base64url')}`;
}

export async function activateCustomDomainRequest(id: string, selectedTarget?: string): Promise<Result> {
  try {
    const admin = await requireHQAdmin();
    const request = await prisma.customDomainRequest.findUnique({ where: { id }, select: { organizationId: true, propertyId: true, domain: true, status: true, metadata: true } });
    if (!request || request.status !== 'PAID') throw new Error('A paid request is required before activation.');
    const entitlement = await prisma.entitlement.findFirst({ where: { organizationId: request.organizationId, propertyId: request.propertyId, productCode: 'ADDON_CUSTOM_DOMAIN', status: 'ACTIVE' }, select: { id: true } });
    if (!entitlement) throw new Error('Payment received, but the custom-domain entitlement has not been reconciled yet.');

    const customWebsite = await prisma.customWebsiteRequest.findFirst({ where: { organizationId: request.organizationId, propertyId: request.propertyId, developmentMode: { in: ['STANDALONE_API', 'PMS_CONNECTED'] }, status: { notIn: ['REJECTED', 'CANCELLED'] } }, orderBy: { createdAt: 'desc' }, select: { developmentMode: true } });
    const isWebsiteRequest = metadataString(request.metadata, 'source') === 'custom_website_addon';
    const inferredTarget = metadataString(request.metadata, 'domainTarget')
      ?? (isWebsiteRequest && customWebsite?.developmentMode === 'STANDALONE_API' ? 'STANDALONE_API' : isWebsiteRequest && customWebsite ? 'LODGECORE_WEBSITE' : 'BOOKING_ENGINE');
    const target = selectedTarget && ['STANDALONE_API', 'LODGECORE_WEBSITE', 'BOOKING_ENGINE'].includes(selectedTarget) ? selectedTarget : inferredTarget;
    const origins = domainOrigins(request.domain);

    if (target === 'STANDALONE_API') {
      if (!customWebsite || customWebsite.developmentMode !== 'STANDALONE_API') throw new Error('The customer does not have an active Standalone API website addon.');
      const integration = await prisma.propertyIntegration.findFirst({ where: { organizationId: request.organizationId, propertyId: request.propertyId, provider: 'CUSTOM_WEBSITE' }, select: { id: true } })
        ?? await prisma.propertyIntegration.create({ data: { organizationId: request.organizationId, propertyId: request.propertyId, name: 'Standalone website API', provider: 'CUSTOM_WEBSITE', status: 'ACTIVE' }, select: { id: true } });
      const key = await prisma.publishableKey.findFirst({ where: { integrationId: integration.id, environment: 'LIVE', status: 'ACTIVE' }, select: { id: true } });
      if (key) await prisma.publishableKey.update({ where: { id: key.id }, data: { allowedOrigins: origins } });
      else await prisma.publishableKey.create({ data: { integrationId: integration.id, key: createPublishableKey(), environment: 'LIVE', status: 'ACTIVE', allowedOrigins: origins } });
    } else if (target === 'LODGECORE_WEBSITE') {
      if (!customWebsite || customWebsite.developmentMode !== 'PMS_CONNECTED') throw new Error('The customer does not have an active LodgeCore website addon.');
      const property = await prisma.property.findUnique({ where: { id: request.propertyId }, select: { name: true } });
      if (!property) throw new Error('Property not found for website configuration.');
      const project = await prisma.websiteProject.findFirst({ where: { organizationId: request.organizationId, propertyId: request.propertyId }, select: { id: true } });
      const token = `lodgecore-website-${crypto.randomBytes(24).toString('hex')}`;
      if (project) await prisma.websiteProject.update({ where: { id: project.id }, data: { customDomain: request.domain, customDomainVerificationToken: token, customDomainVerifiedAt: null } });
      else await prisma.websiteProject.create({ data: { organizationId: request.organizationId, propertyId: request.propertyId, name: `${property.name} website`, status: 'DRAFT', customDomain: request.domain, customDomainVerificationToken: token } });
    } else {
      const bookingEntitlement = await prisma.entitlement.findFirst({ where: { organizationId: request.organizationId, propertyId: request.propertyId, productCode: 'ADDON_BOOKING_ENGINE', status: 'ACTIVE' }, select: { id: true } });
      if (!bookingEntitlement) throw new Error('The customer does not have an active Booking Engine addon.');
      const site = await prisma.bookingSite.findUnique({ where: { propertyId: request.propertyId }, select: { id: true } });
      if (!site) throw new Error('Configure the Booking Engine site before activating its domain.');
      await prisma.bookingSite.update({ where: { id: site.id }, data: { customDomain: request.domain, domainStatus: 'PENDING', verificationToken: `lodgecore-booking-${crypto.randomUUID()}`, verifiedAt: null } });
    }

    await prisma.customDomainRequest.update({ where: { id }, data: { status: 'ACTIVE', activatedAt: new Date(), reviewedBy: admin.email } });
    revalidatePath('/hq/custom-domains');
    revalidatePath(`/portal/settings/booking-engine/${request.propertyId}`);
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Activation failed' }; }
}
