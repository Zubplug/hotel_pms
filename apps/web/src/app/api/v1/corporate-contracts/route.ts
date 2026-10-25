import { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';
import { hasEntitlement } from '@/lib/auth/entitlement';

const ruleSchema = z.object({
  roomTypeId: z.string().uuid(),
  sourceRatePlanId: z.string().uuid().optional(),
  amount: z.number().finite().positive().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  minAdults: z.number().int().min(1).max(20),
  maxAdults: z.number().int().min(1).max(20).nullable(),
  minChildren: z.number().int().min(0).max(20),
  maxChildren: z.number().int().min(0).max(20).nullable(),
  minOccupancy: z.number().int().min(1).max(40),
  maxOccupancy: z.number().int().min(1).max(40).nullable(),
  minStay: z.number().int().min(1).max(365),
  maxStay: z.number().int().min(1).max(365).nullable(),
  minLeadTimeHours: z.number().int().min(0).max(8760),
  maxAdvanceDays: z.number().int().min(0).max(730).nullable(),
  minRooms: z.number().int().min(1).max(20).default(1),
  maxRooms: z.number().int().min(1).max(20).nullable().default(null),
  pricingFactors: z.record(z.string(), z.unknown()).nullable().default(null),
  weekdays: z.array(z.number().int().min(0).max(6)),
  blackoutDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

const draftSchema = z.object({
  propertyId: z.string().uuid(),
  corporateAccountId: z.string().uuid().optional(),
  corporateBookingApplicationId: z.string().uuid().optional(),
  editContractId: z.string().uuid().optional(),
  isPropertyDefault: z.boolean().default(false),
  reference: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  paymentMode: z.enum(['PAY_LATER', 'FULL', 'DEPOSIT']),
  depositMinimumPercent: z.number().min(0).max(100).nullable().optional(),
  negotiationEnabled: z.boolean().optional(),
  negotiationMinRooms: z.number().int().min(1).nullable().optional(),
  negotiationMinNights: z.number().int().min(1).nullable().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  rules: z.array(ruleSchema).min(1),
}).refine((value) => value.isPropertyDefault
  ? !value.corporateAccountId && !value.corporateBookingApplicationId
  : Boolean(value.corporateAccountId) !== Boolean(value.corporateBookingApplicationId), { message: 'Provide either one corporate identity or a property default contract' })
  .refine((value) => value.isPropertyDefault
    ? value.rules.every((rule) => rule.amount == null)
    : value.rules.every((rule) => rule.amount != null), { message: 'Property-default rules use the selected PMS rate plan; identity contracts require explicit rates' });

function validDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid contract date');
  return date;
}

const PROPERTY_DEFAULT_PRICING_FACTORS = {
  roomCount: [
    { minRooms: 1, maxRooms: 3, adjustmentType: 'PERCENT_DISCOUNT', value: 0 },
    { minRooms: 4, maxRooms: 7, adjustmentType: 'PERCENT_DISCOUNT', value: 3 },
    { minRooms: 8, maxRooms: null, adjustmentType: 'PERCENT_DISCOUNT', value: 5 },
  ],
  stayLength: [
    { minNights: 1, maxNights: 2, adjustmentType: 'PERCENT_DISCOUNT', value: 0 },
    { minNights: 3, maxNights: 6, adjustmentType: 'PERCENT_DISCOUNT', value: 2 },
    { minNights: 7, maxNights: null, adjustmentType: 'PERCENT_DISCOUNT', value: 5 },
  ],
  paymentMode: {
    FULL: { adjustmentType: 'FIXED_NIGHTLY_ADJUSTMENT', value: -2000 },
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const accountId = req.nextUrl.searchParams.get('corporateAccountId');
    const applicationId = req.nextUrl.searchParams.get('corporateBookingApplicationId');
    const propertyId = req.nextUrl.searchParams.get('propertyId');
    if (!accountId && !applicationId && !propertyId) return errorResponse('BAD_REQUEST', 'Provide a propertyId, corporateAccountId, or corporateBookingApplicationId', 400);
    if ((accountId && applicationId) || (accountId && propertyId) || (applicationId && propertyId)) return errorResponse('BAD_REQUEST', 'Provide only one contract scope', 400);
    if (propertyId) {
      const property = await prisma.property.findFirst({ where: { id: { equals: propertyId, in: [...propertyIds] }, organizationId }, select: { id: true } });
      if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);
      if (!(await hasEntitlement(organizationId, 'ADDON_CORPORATE_API', property.id))) return errorResponse('PAYMENT_REQUIRED', 'An active Corporate API add-on is required for corporate API contracts.', 402);
      if (!(await hasPermission(session.user.id, property.id, 'corporate_account:view'))) return errorResponse('FORBIDDEN', 'Missing corporate account permission', 403);
      const contracts = await prisma.corporateContract.findMany({
        where: { organizationId, isPropertyDefault: true, defaultPropertyId: property.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, reference: true, name: true, status: true, defaultCurrency: true, paymentMode: true, depositMinimumPercent: true, negotiationEnabled: true, negotiationMinRooms: true, negotiationMinNights: true, effectiveFrom: true, effectiveTo: true, isPropertyDefault: true, defaultPropertyId: true, defaultProperty: { select: { name: true, code: true } }, versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, status: true, effectiveFrom: true, effectiveTo: true, submittedAt: true, approvedAt: true, rules: { select: { id: true, roomTypeId: true, amount: true, currency: true, minAdults: true, maxAdults: true, minChildren: true, maxChildren: true, minOccupancy: true, maxOccupancy: true, minStay: true, maxStay: true, minRooms: true, maxRooms: true, pricingFactors: true, sourceRatePlanId: true } } } } },
      });
      return successResponse(contracts);
    }
    const account = accountId ? await prisma.corporateAccount.findFirst({ where: { id: accountId, organizationId, propertyId: { in: [...propertyIds] } }, select: { propertyId: true } }) : null;
    const application = applicationId ? await prisma.corporateBookingApplication.findFirst({ where: { id: applicationId, organizationId, propertyId: { in: [...propertyIds] } }, select: { propertyId: true } }) : null;
    const identityPropertyId = account?.propertyId || application?.propertyId;
    if (!identityPropertyId) return errorResponse('NOT_FOUND', 'Corporate identity not found', 404);
    if (!(await hasEntitlement(organizationId, 'ADDON_CORPORATE_API', identityPropertyId))) return errorResponse('PAYMENT_REQUIRED', 'An active Corporate API add-on is required for corporate API contracts.', 402);
    if (!(await hasPermission(session.user.id, identityPropertyId, 'corporate_account:view'))) return errorResponse('FORBIDDEN', 'Missing corporate account permission', 403);
    const contracts = await prisma.corporateContract.findMany({
      where: { organizationId, ...(accountId ? { corporateAccountId: accountId } : { corporateBookingApplicationId: applicationId }) },
      orderBy: { createdAt: 'desc' },
      include: { versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, status: true, effectiveFrom: true, effectiveTo: true, rules: { select: { id: true, roomTypeId: true, amount: true, currency: true, minAdults: true, maxAdults: true, minOccupancy: true, maxOccupancy: true, minStay: true, maxStay: true } } } } },
    });
    return successResponse(contracts);
  } catch (error) {
    console.error('[corporate-contracts/get]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load corporate API contracts', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const parsed = draftSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid corporate API contract draft', 400, parsed.error.flatten());
    const body = parsed.data;
    const negotiationEnabled = body.negotiationEnabled ?? body.isPropertyDefault;
    const negotiationMinRooms = body.negotiationMinRooms ?? (body.isPropertyDefault ? 10 : null);
    const negotiationMinNights = body.negotiationMinNights ?? (body.isPropertyDefault ? 3 : null);

    const account = body.corporateAccountId ? await prisma.corporateAccount.findFirst({ where: { id: body.corporateAccountId, organizationId, propertyId: { in: [...propertyIds] } }, select: { id: true, propertyId: true, isActive: true, ratePlanId: true } }) : null;
    const application = body.corporateBookingApplicationId ? await prisma.corporateBookingApplication.findFirst({ where: { id: body.corporateBookingApplicationId, organizationId, propertyId: { in: [...propertyIds] } }, select: { id: true, propertyId: true, status: true } }) : null;
    const property = await prisma.property.findFirst({ where: { id: { equals: body.propertyId, in: [...propertyIds] }, organizationId }, select: { id: true } });
    const identityPropertyId = body.isPropertyDefault ? property?.id : (account?.propertyId || application?.propertyId);
    if (!identityPropertyId) return errorResponse('NOT_FOUND', 'Corporate identity not found', 404);
    if (!(await hasEntitlement(organizationId, 'ADDON_CORPORATE_API', identityPropertyId))) return errorResponse('PAYMENT_REQUIRED', 'An active Corporate API add-on is required for corporate API contracts.', 402);
    if (!(await hasPermission(session.user.id, identityPropertyId, 'corporate_account:edit'))) return errorResponse('FORBIDDEN', 'Missing corporate contract edit permission', 403);
    if (account && !account.isActive) return errorResponse('CONFLICT', 'Inactive corporate accounts cannot receive API contract drafts', 409);
    if (application && application.status !== 'PENDING') return errorResponse('CONFLICT', 'Only pending corporate applications can receive a new contract draft', 409);

    const effectiveFrom = validDate(body.effectiveFrom);
    const effectiveTo = body.effectiveTo ? validDate(body.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) return errorResponse('BAD_REQUEST', 'Contract end date must be after the start date', 400);

    const result = await prisma.$transaction(async tx => {
      const property = await tx.property.findFirst({ where: { id: identityPropertyId, organizationId }, select: { baseCurrency: true, supportedCurrencies: true } });
      if (!property) throw Object.assign(new Error('Property not found'), { code: 'INVALID_SCOPE' });
      const supported = new Set((property.supportedCurrencies ?? []).map(value => value.toUpperCase()));
      supported.add(property.baseCurrency.toUpperCase());
      if (!supported.has(body.defaultCurrency)) throw Object.assign(new Error('Contract currency is not supported by the property'), { code: 'INVALID_CURRENCY' });
      for (const rule of body.rules) {
        if (!supported.has(rule.currency)) throw Object.assign(new Error(`Currency ${rule.currency} is not supported by the property`), { code: 'INVALID_CURRENCY' });
        if (rule.maxAdults != null && rule.maxAdults < rule.minAdults) throw Object.assign(new Error('Maximum adults cannot be below minimum adults'), { code: 'INVALID_RULE' });
        if (rule.maxChildren != null && rule.maxChildren < rule.minChildren) throw Object.assign(new Error('Maximum children cannot be below minimum children'), { code: 'INVALID_RULE' });
        if (rule.maxOccupancy != null && rule.maxOccupancy < rule.minOccupancy) throw Object.assign(new Error('Maximum occupancy cannot be below minimum occupancy'), { code: 'INVALID_RULE' });
        if (rule.maxStay != null && rule.maxStay < rule.minStay) throw Object.assign(new Error('Maximum stay cannot be below minimum stay'), { code: 'INVALID_RULE' });
        if (rule.maxRooms != null && rule.maxRooms < rule.minRooms) throw Object.assign(new Error('Maximum rooms cannot be below minimum rooms'), { code: 'INVALID_RULE' });
      }
      const roomTypes = await tx.roomType.findMany({ where: { id: { in: body.rules.map(rule => rule.roomTypeId) }, propertyId: identityPropertyId, isActive: true, deletedAt: null }, select: { id: true } });
      if (roomTypes.length !== new Set(body.rules.map(rule => rule.roomTypeId)).size) throw Object.assign(new Error('Every contract rule must reference an active room type in this property'), { code: 'INVALID_RULE' });

      const corporateRatePlans = await tx.ratePlan.findMany({ where: { propertyId: identityPropertyId, type: body.isPropertyDefault ? 'STANDARD' : 'CORPORATE', isActive: true, deletedAt: null }, select: { id: true } });
      const allowedCorporateRatePlanIds = new Set(corporateRatePlans.map((plan: { id: string }) => plan.id));
      const accountRatePlanId = account?.ratePlanId || null;
      for (const rule of body.rules) {
        const sourceRatePlanId = rule.sourceRatePlanId || accountRatePlanId;
        if (!sourceRatePlanId || !allowedCorporateRatePlanIds.has(sourceRatePlanId)) throw Object.assign(new Error('Each contract rule must reference an active CORPORATE rate plan'), { code: 'INVALID_RATE_PLAN' });
      }

      if (body.editContractId) {
        const existing = await tx.corporateContract.findFirst({ where: { id: body.editContractId, organizationId, isPropertyDefault: true, defaultPropertyId: identityPropertyId, status: 'ACTIVE' }, include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } } } });
        if (!existing) throw Object.assign(new Error('The active property default contract could not be found'), { code: 'NOT_FOUND' });
        const version = await tx.corporateContractVersion.create({ data: { contractId: existing.id, version: (existing.versions[0]?.version || 0) + 1, status: 'SUBMITTED', effectiveFrom, effectiveTo, submittedBy: session.user.id, submittedAt: new Date(), termsSnapshot: { channel: 'CORPORATE_API', scope: 'PROPERTY_DEFAULT_EDIT', name: body.name, defaultCurrency: body.defaultCurrency, paymentMode: body.paymentMode, depositMinimumPercent: body.depositMinimumPercent ?? null, negotiationEnabled, negotiationMinRooms, negotiationMinNights } } });
        const editRules = body.rules.map(rule => ({
          contractVersionId: version.id,
          propertyId: identityPropertyId,
          roomTypeId: rule.roomTypeId,
          sourceRatePlanId: rule.sourceRatePlanId || null,
          rateMethod: 'DERIVED_RATE',
          amount: null,
          currency: rule.currency,
          priority: 100,
          minAdults: rule.minAdults,
          maxAdults: rule.maxAdults,
          minChildren: rule.minChildren,
          maxChildren: rule.maxChildren,
          minOccupancy: rule.minOccupancy,
          maxOccupancy: rule.maxOccupancy,
          minStay: rule.minStay,
          maxStay: rule.maxStay,
          minLeadTimeHours: rule.minLeadTimeHours,
          maxAdvanceDays: rule.maxAdvanceDays,
          minRooms: rule.minRooms,
          maxRooms: rule.maxRooms,
          weekdays: rule.weekdays,
          blackoutDates: rule.blackoutDates.map(validDate),
          fallbackAllowed: false,
          pricingFactors: rule.pricingFactors as any,
        }));
        await tx.corporateRateRule.createMany({ data: editRules });
        await tx.approvalRequest.create({ data: { propertyId: identityPropertyId, type: 'CORPORATE_CONTRACT', status: 'PENDING', requestedBy: session.user.id, reason: `Review edited property default Corporate API contract ${existing.reference}`, details: { contractId: existing.id, versionId: version.id, stage: 'MANAGEMENT_REVIEW', reference: existing.reference, contractType: 'PROPERTY_DEFAULT', editExisting: true, proposedTerms: { name: body.name, defaultCurrency: body.defaultCurrency, paymentMode: body.paymentMode, depositMinimumPercent: body.depositMinimumPercent ?? null, negotiationEnabled, negotiationMinRooms, negotiationMinNights, effectiveFrom: body.effectiveFrom, effectiveTo: body.effectiveTo } }, snapshot: { contractId: existing.id, versionId: version.id, reference: existing.reference, name: body.name, defaultCurrency: body.defaultCurrency, paymentMode: body.paymentMode, depositMinimumPercent: body.depositMinimumPercent ?? null, rules: body.rules as any } } });
        return { id: existing.id, versionId: version.id, status: 'ACTIVE', approvalStage: 'MANAGEMENT_REVIEW', editExisting: true };
      }

      if (body.isPropertyDefault) {
        await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${identityPropertyId}::uuid FOR UPDATE`;
        const existingDefault = await tx.corporateContract.findFirst({
          where: { organizationId, isPropertyDefault: true, defaultPropertyId: identityPropertyId, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'SUSPENDED'] } },
          select: { reference: true },
        });
        if (existingDefault) throw Object.assign(new Error(`This property already has a default corporate contract (${existingDefault.reference})`), { code: 'DUPLICATE_DEFAULT' });
      }
      const duplicate = await tx.corporateContract.findFirst({ where: { organizationId, reference: body.reference } });
      if (duplicate) throw Object.assign(new Error('A contract with this reference already exists'), { code: 'DUPLICATE_REFERENCE' });

      const isApprovalRoutedDefault = body.isPropertyDefault;
      const contract = await tx.corporateContract.create({ data: {
        organizationId,
        corporateAccountId: account?.id || null,
        corporateBookingApplicationId: application?.id || null,
        isPropertyDefault: body.isPropertyDefault,
        defaultPropertyId: body.isPropertyDefault ? identityPropertyId : null,
        reference: body.reference,
        name: body.name,
        status: isApprovalRoutedDefault ? 'SUBMITTED' : 'DRAFT',
        defaultCurrency: body.defaultCurrency,
        paymentMode: body.paymentMode,
        depositMinimumPercent: body.depositMinimumPercent ?? null,
        negotiationEnabled,
        negotiationMinRooms,
        negotiationMinNights,
        fallbackPolicy: 'NONE',
        effectiveFrom,
        effectiveTo,
        properties: { create: { propertyId: identityPropertyId, status: 'ACTIVE', effectiveFrom, effectiveTo } },
        versions: { create: { version: 1, status: isApprovalRoutedDefault ? 'SUBMITTED' : 'DRAFT', effectiveFrom, effectiveTo, submittedBy: isApprovalRoutedDefault ? session.user.id : null, submittedAt: isApprovalRoutedDefault ? new Date() : null, termsSnapshot: { channel: 'CORPORATE_API', scope: body.isPropertyDefault ? 'PROPERTY_DEFAULT' : 'IDENTITY_NEGOTIATED', paymentMode: body.paymentMode, depositMinimumPercent: body.depositMinimumPercent ?? null, negotiationEnabled, negotiationMinRooms, negotiationMinNights, createdBy: session.user.id } } },
      }, include: { versions: true } });
      const version = contract.versions[0];
      const defaultSourceRatePlanId = accountRatePlanId;
      await tx.corporateRateRule.createMany({ data: body.rules.map(rule => ({
        contractVersionId: version.id,
        propertyId: identityPropertyId,
        roomTypeId: rule.roomTypeId,
        sourceRatePlanId: rule.sourceRatePlanId || defaultSourceRatePlanId || null,
        rateMethod: body.isPropertyDefault ? 'DERIVED_RATE' : 'FIXED_NIGHTLY',
        amount: body.isPropertyDefault ? null : rule.amount,
        currency: rule.currency,
        priority: 100,
        minAdults: rule.minAdults,
        maxAdults: rule.maxAdults,
        minChildren: rule.minChildren,
        maxChildren: rule.maxChildren,
        minOccupancy: rule.minOccupancy,
        maxOccupancy: rule.maxOccupancy,
        minStay: rule.minStay,
        maxStay: rule.maxStay,
        minLeadTimeHours: rule.minLeadTimeHours,
        maxAdvanceDays: rule.maxAdvanceDays,
        minRooms: rule.minRooms,
        maxRooms: rule.maxRooms,
        weekdays: rule.weekdays,
        blackoutDates: rule.blackoutDates.map(validDate),
        fallbackAllowed: false,
        pricingFactors: (rule.pricingFactors ?? (body.isPropertyDefault ? PROPERTY_DEFAULT_PRICING_FACTORS : null)) as any,
      })) });
      await tx.auditLog.create({ data: { organizationId, propertyId: identityPropertyId, userId: session.user.id, action: 'CREATE', resource: 'corporate_contract_draft', resourceId: contract.id, newValue: { contractId: contract.id, versionId: version.id, corporateAccountId: account?.id || null, corporateBookingApplicationId: application?.id || null, reference: body.reference }, requestId: crypto.randomUUID() } });
      if (isApprovalRoutedDefault) {
        await tx.approvalRequest.create({ data: { propertyId: identityPropertyId, type: 'CORPORATE_CONTRACT', status: 'PENDING', requestedBy: session.user.id, reason: `Review property default Corporate API contract ${body.reference}`, details: { contractId: contract.id, versionId: version.id, stage: 'MANAGEMENT_REVIEW', reference: body.reference, contractType: 'PROPERTY_DEFAULT' }, snapshot: { contractId: contract.id, versionId: version.id, reference: body.reference, name: body.name, defaultCurrency: body.defaultCurrency, paymentMode: body.paymentMode, rules: body.rules as any } } });
      }
      return { id: contract.id, versionId: version.id, status: contract.status, approvalStage: isApprovalRoutedDefault ? 'MANAGEMENT_REVIEW' : null };
    });
    return successResponse(result, 201);
  } catch (error: any) {
    if (['INVALID_SCOPE', 'INVALID_CURRENCY', 'INVALID_RULE', 'INVALID_RATE_PLAN', 'DUPLICATE_REFERENCE', 'DUPLICATE_DEFAULT'].includes(error?.code)) return errorResponse('BAD_REQUEST', error.message, 400);
    if (error?.code === 'NOT_FOUND') return errorResponse('NOT_FOUND', error.message, 404);
    console.error('[corporate-contracts/post]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to create corporate API contract draft', 500);
  }
}
