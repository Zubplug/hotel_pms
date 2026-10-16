import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import prisma from '@hotel-pms/db';
import { createFlutterwaveCheckout } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasEntitlement } from '@/lib/auth/entitlement';

const ELIGIBLE_PRODUCTS = [
  'ADDON_BOOKING_ENGINE',
  'ADDON_CUSTOM_WEBSITE_API',
  'ADDON_CUSTOM_WEBSITE_PMS',
] as const;

async function resolveProperty(userId: string, propertyId: string | null) {
  const context = await requireOrganizationContext(userId);
  const resolvedId = propertyId || context.propertyIds[0];
  if (!resolvedId || !context.propertyIds.includes(resolvedId)) throw new Error('Property is outside your access scope');
  const property = await prisma.property.findFirst({
    where: { id: resolvedId, organizationId: context.organizationId, isActive: true },
    select: { id: true, organizationId: true, baseCurrency: true },
  });
  if (!property) throw new Error('Property not found');
  return { context, property };
}

async function eligibility(organizationId: string, propertyId: string) {
  const products = await Promise.all(ELIGIBLE_PRODUCTS.map(async (productCode) => ({
    productCode,
    active: await hasEntitlement(organizationId, productCode, propertyId),
  })));
  return { products, eligible: products.some((product) => product.active) };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { property } = await resolveProperty(session.user.id, req.nextUrl.searchParams.get('propertyId'));
    const [program, access, reachAddon] = await Promise.all([
      prisma.referralProgram.findUnique({ where: { propertyId: property.id } }),
      eligibility(property.organizationId, property.id),
      hasEntitlement(property.organizationId, 'ADDON_REACH', property.id),
    ]);
    return successResponse({ propertyId: property.id, currency: property.baseCurrency, program, reachEnabled: Boolean(program?.enabled && reachAddon), eligibility: access });
  } catch (error: any) {
    return errorResponse('FORBIDDEN', error?.message || 'Unable to resolve property', 403);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { property, context } = await resolveProperty(session.user.id, req.nextUrl.searchParams.get('propertyId'));
    const access = await eligibility(property.organizationId, property.id);
    if (!access.eligible) return errorResponse('PAYMENT_REQUIRED', 'An eligible digital commerce product is required before Reach can be activated', 402, access);

    const body = await req.json().catch(() => ({}));
    const enabled = body?.enabled === true;
    const attributionWindowDays = Number(body?.attributionWindowDays ?? 30);
    const platformFeeBps = Number(body?.platformFeeBps ?? 100);
    const minimumPayout = Number(body?.minimumPayout ?? 5000);
    if (!Number.isInteger(attributionWindowDays) || attributionWindowDays < 1 || attributionWindowDays > 365) {
      return errorResponse('BAD_REQUEST', 'attributionWindowDays must be between 1 and 365', 400);
    }
    if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 5000) {
      return errorResponse('BAD_REQUEST', 'platformFeeBps must be between 0 and 5000', 400);
    }
    if (!Number.isFinite(minimumPayout) || minimumPayout < 0) return errorResponse('BAD_REQUEST', 'minimumPayout must be non-negative', 400);

    const now = new Date();
    const existing = await prisma.referralProgram.findUnique({ where: { propertyId: property.id } });
    const activationPrice = await prisma.billingPrice.findFirst({ where: { product: { code: 'ADDON_REACH', active: true }, interval: 'one_time' }, orderBy: { createdAt: 'desc' } });
    const activationAmount = activationPrice ? activationPrice.amount / 100 : Number(existing?.activationFeeAmount ?? 50000);
    const activationCurrency = activationPrice?.currency || property.baseCurrency;
    const alreadyPaid = existing?.activationPaymentStatus === 'PAID' || activationAmount <= 0;
    if (enabled && !alreadyPaid) {
      const email = session.user.email;
      if (!email) return errorResponse('BAD_REQUEST', 'A billing email is required for Reach activation', 400);
      if (!process.env.FLW_SECRET_KEY) return errorResponse('SERVICE_UNAVAILABLE', 'Flutterwave activation billing is not configured', 503);
      const program = await prisma.referralProgram.upsert({
        where: { propertyId: property.id },
        create: { organizationId: context.organizationId, propertyId: property.id, enabled: false, attributionWindowDays, platformFeeBps, minimumPayout, activationFeeAmount: activationAmount, activationFeeCurrency: activationCurrency, activationPaymentStatus: 'PENDING' },
        update: { attributionWindowDays, platformFeeBps, minimumPayout, activationFeeAmount: activationAmount, activationFeeCurrency: activationCurrency, activationPaymentStatus: 'PENDING' },
      });
      const providerReference = `reach-activation-${property.id}-${randomUUID()}`;
      const payment = await prisma.referralActivationPayment.create({ data: { organizationId: context.organizationId, propertyId: property.id, programId: program.id, amount: activationAmount, currency: activationCurrency, providerReference } });
      const checkout = await createFlutterwaveCheckout({ amount: activationAmount, currency: activationCurrency, txRef: providerReference, redirectUrl: `${process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://getlodgecore.vercel.app'}/portal/dashboard?reachActivation=true`, customer: { email, name: session.user.name || undefined }, meta: { lodgecore_source: 'reach_activation', organizationId: context.organizationId, propertyId: property.id, activationPaymentId: payment.id } });
      return successResponse({ activationRequired: true, activationFee: activationAmount, currency: activationCurrency, checkoutUrl: checkout.link, program, eligibility: access }, 200);
    }
    const program = await prisma.referralProgram.upsert({
      where: { propertyId: property.id },
      create: {
        organizationId: context.organizationId,
        propertyId: property.id,
        enabled,
        attributionWindowDays,
        platformFeeBps,
        minimumPayout,
        activationPaymentStatus: alreadyPaid ? 'PAID' : undefined,
        activatedAt: enabled ? now : null,
        pausedAt: enabled ? null : now,
      },
      update: {
        enabled,
        attributionWindowDays,
        platformFeeBps,
        minimumPayout,
        ...(alreadyPaid ? { activationPaymentStatus: 'PAID' } : {}),
        ...(enabled ? { activatedAt: now, pausedAt: null } : { pausedAt: now }),
      },
    });
    return successResponse({ program, eligibility: access });
  } catch (error: any) {
    return errorResponse('FORBIDDEN', error?.message || 'Unable to update Reach settings', 403);
  }
}
