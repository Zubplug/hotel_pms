import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

const rateSchema = z.object({
  roomTypeId: z.string().uuid(), amount: z.number().positive(), currency: z.string().regex(/^[A-Z]{3}$/),
  minStay: z.number().int().min(1).optional(), maxStay: z.number().int().min(1).nullable().optional(),
  minRooms: z.number().int().min(1).optional(), maxRooms: z.number().int().min(1).nullable().optional(),
  minAdults: z.number().int().min(1).optional(), maxAdults: z.number().int().min(1).nullable().optional(),
  minChildren: z.number().int().min(0).optional(), maxChildren: z.number().int().min(0).nullable().optional(),
});
const schema = z.object({
  action: z.enum(['UNDER_REVIEW', 'APPROVE', 'REJECT']),
  reviewerNotes: z.string().trim().max(2000).optional(),
  proposedRates: z.array(rateSchema).min(1).optional(),
  paymentMode: z.enum(['PAY_LATER', 'FULL', 'DEPOSIT', 'PREPAID']).optional(),
});

function day(value: unknown, fallback: Date) {
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid negotiation review', 400, parsed.error.flatten());
    const id = (await context.params).id;
    const request: any = await prisma.corporateRateNegotiationRequest.findFirst({ where: { id, organizationId, propertyId: { in: [...propertyIds] } } });
    if (!request) return errorResponse('NOT_FOUND', 'Negotiation request not found', 404);
    if (!(await hasPermission(session.user.id, request.propertyId, 'corporate_account:edit'))) return errorResponse('FORBIDDEN', 'Missing corporate contract approval permission', 403);
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(request.status)) return errorResponse('CONFLICT', `This negotiation is already ${request.status}`, 409);
    if (parsed.data.action === 'UNDER_REVIEW') {
      const updated = await prisma.corporateRateNegotiationRequest.update({ where: { id }, data: { status: 'UNDER_REVIEW', reviewerNotes: parsed.data.reviewerNotes || null, reviewedBy: session.user.id, reviewedAt: new Date(), ...(parsed.data.proposedRates ? { proposedRates: parsed.data.proposedRates } : {}) } });
      return successResponse({ id: updated.id, status: updated.status });
    }
    if (parsed.data.action === 'REJECT') {
      const updated = await prisma.corporateRateNegotiationRequest.update({ where: { id }, data: { status: 'REJECTED', reviewerNotes: parsed.data.reviewerNotes || 'Negotiation request rejected', reviewedBy: session.user.id, reviewedAt: new Date() } });
      return successResponse({ id: updated.id, status: updated.status });
    }

    const rates = (parsed.data.proposedRates || request.proposedRates) as Array<Record<string, any>>;
    const terms = (request.requestedTerms || {}) as Record<string, any>;
    const effectiveFrom = day(terms.checkIn, new Date());
    const effectiveTo = day(terms.checkOut, new Date(effectiveFrom.getTime() + 24 * 60 * 60 * 1000));
    const account = request.corporateAccountId ? await prisma.corporateAccount.findUnique({ where: { id: request.corporateAccountId }, select: { id: true, ratePlanId: true } }) : null;
    const defaultRules = await prisma.corporateRateRule.findMany({ where: { propertyId: request.propertyId, contractVersion: { status: 'ACTIVE', contract: { isPropertyDefault: true, defaultPropertyId: request.propertyId, status: 'ACTIVE' } } }, select: { roomTypeId: true, sourceRatePlanId: true } });
    const corporatePlans = await prisma.ratePlan.findMany({ where: { propertyId: request.propertyId, type: { in: ['STANDARD', 'CORPORATE'] }, isActive: true, deletedAt: null }, select: { id: true } });
    const planIds = new Set(corporatePlans.map(plan => plan.id));
    const sourceByRoom = new Map(defaultRules.map(rule => [rule.roomTypeId, rule.sourceRatePlanId]));
    const sourceFor = (rate: Record<string, any>) => account?.ratePlanId && planIds.has(account.ratePlanId) ? account.ratePlanId : sourceByRoom.get(rate.roomTypeId);
    if (rates.some(rate => !sourceFor(rate))) return errorResponse('CONFLICT', 'A normal PMS rate-plan anchor is required for every negotiated room type before approval.', 409);

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.corporateContract.findFirst({ where: { organizationId, ...(request.corporateAccountId ? { corporateAccountId: request.corporateAccountId } : { corporateBookingApplicationId: request.corporateBookingApplicationId }), status: 'ACTIVE', effectiveFrom: { lte: effectiveTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }], properties: { some: { propertyId: request.propertyId, status: 'ACTIVE' } } }, select: { reference: true } });
      if (existing) throw Object.assign(new Error(`An active contract already covers this identity and period: ${existing.reference}`), { code: 'CONTRACT_CONFLICT' });
      const reference = `NEG-${request.id.slice(0, 12).toUpperCase()}`;
      const contract = await tx.corporateContract.create({ data: { organizationId, corporateAccountId: request.corporateAccountId, corporateBookingApplicationId: request.corporateBookingApplicationId, reference, name: `Negotiated corporate rate ${request.reference || request.id.slice(0, 8)}`, status: 'ACTIVE', defaultCurrency: String(rates[0].currency).toUpperCase(), paymentMode: parsed.data.paymentMode || String(terms.paymentMode || 'PAY_LATER').toUpperCase(), fallbackPolicy: 'NONE', effectiveFrom, effectiveTo, properties: { create: { propertyId: request.propertyId, status: 'ACTIVE', effectiveFrom, effectiveTo } }, versions: { create: { version: 1, status: 'ACTIVE', effectiveFrom, effectiveTo, approvedBy: session.user.id, approvedAt: new Date(), termsSnapshot: { channel: 'CORPORATE_API_NEGOTIATION', negotiationRequestId: request.id, approvedBy: session.user.id } } } }, include: { versions: true } });
      const version = contract.versions[0];
      await tx.corporateRateRule.createMany({ data: rates.map(rate => ({ contractVersionId: version.id, propertyId: request.propertyId, roomTypeId: rate.roomTypeId, sourceRatePlanId: sourceFor(rate), rateMethod: 'FIXED_NIGHTLY', amount: rate.amount, currency: String(rate.currency).toUpperCase(), priority: 200, minAdults: rate.minAdults || 1, maxAdults: rate.maxAdults ?? null, minChildren: rate.minChildren || 0, maxChildren: rate.maxChildren ?? null, minOccupancy: (rate.minAdults || 1) + (rate.minChildren || 0), maxOccupancy: (rate.maxAdults ?? rate.minAdults ?? 20) + (rate.maxChildren ?? rate.minChildren ?? 20), minStay: rate.minStay || 1, maxStay: rate.maxStay ?? null, minLeadTimeHours: 0, maxAdvanceDays: null, minRooms: rate.minRooms || 1, maxRooms: rate.maxRooms ?? null, weekdays: [], blackoutDates: [], fallbackAllowed: false })) });
      // Quote creation belongs to the website booking engine. The public
      // client creates a fresh quote after approval so it uses this newly
      // active negotiated contract and current availability.
      const approvedQuoteId: string | null = null;
      const updated = await tx.corporateRateNegotiationRequest.update({ where: { id }, data: { status: 'APPROVED', proposedRates: rates, reviewerNotes: parsed.data.reviewerNotes || null, reviewedBy: session.user.id, reviewedAt: new Date(), resultingContractId: contract.id, approvedQuoteId } });
      await tx.auditLog.create({ data: { organizationId, propertyId: request.propertyId, userId: session.user.id, action: 'APPROVE', resource: 'corporate_rate_negotiation', resourceId: request.id, newValue: { negotiationRequestId: request.id, contractId: contract.id, status: 'APPROVED' }, requestId: crypto.randomUUID() } });
      return { negotiationRequestId: updated.id, contractId: contract.id, approvedQuoteId, status: updated.status, effectiveFrom, effectiveTo };
    }, { isolationLevel: 'Serializable' });
    return successResponse(result);
  } catch (error: any) {
    if (error?.code === 'CONTRACT_CONFLICT') return errorResponse('CONFLICT', error.message, 409);
    console.error('[corporate-negotiation/review]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to review negotiation request', 500);
  }
}
