import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

const requestSchema = z.object({
  corporateAccountId: z.string().uuid().optional(),
  corporateBookingApplicationId: z.string().uuid().optional(),
  reference: z.string().trim().max(80).optional(),
  requestedTerms: z.record(z.string(), z.unknown()),
  proposedRates: z.array(z.object({
    roomTypeId: z.string().uuid(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    amount: z.number().positive(),
    minAdults: z.number().int().min(1).optional(),
    maxAdults: z.number().int().min(1).nullable().optional(),
    minChildren: z.number().int().min(0).optional(),
    maxChildren: z.number().int().min(0).nullable().optional(),
    minStay: z.number().int().min(1).optional(),
    maxStay: z.number().int().min(1).nullable().optional(),
    minRooms: z.number().int().min(1).optional(),
    maxRooms: z.number().int().min(1).nullable().optional(),
  })).min(1),
}).refine((value) => Boolean(value.corporateAccountId) !== Boolean(value.corporateBookingApplicationId), { message: 'Provide exactly one corporateAccountId or corporateBookingApplicationId' });

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const accountId = req.nextUrl.searchParams.get('corporateAccountId');
    const applicationId = req.nextUrl.searchParams.get('corporateBookingApplicationId');
    if (Boolean(accountId) === Boolean(applicationId)) return errorResponse('BAD_REQUEST', 'Provide exactly one corporateAccountId or corporateBookingApplicationId', 400);
    const identity = accountId
      ? await prisma.corporateAccount.findFirst({ where: { id: accountId, organizationId, propertyId: { in: [...propertyIds] } }, select: { propertyId: true } })
      : await prisma.corporateBookingApplication.findFirst({ where: { id: applicationId!, organizationId, propertyId: { in: [...propertyIds] } }, select: { propertyId: true } });
    if (!identity) return errorResponse('NOT_FOUND', 'Corporate identity not found', 404);
    if (!(await hasPermission(session.user.id, identity.propertyId, 'corporate_account:view'))) return errorResponse('FORBIDDEN', 'Missing corporate account permission', 403);
    const requests = await prisma.corporateRateNegotiationRequest.findMany({
      where: { organizationId, ...(accountId ? { corporateAccountId: accountId } : { corporateBookingApplicationId: applicationId }), propertyId: identity.propertyId },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(requests);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Unable to load rate negotiation requests', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return errorResponse('BAD_REQUEST', 'Invalid rate negotiation request', 400, parsed.error.flatten());

    const account = parsed.data.corporateAccountId ? await prisma.corporateAccount.findFirst({ where: { id: parsed.data.corporateAccountId, organizationId, propertyId: { in: [...propertyIds] }, isActive: true }, select: { id: true, propertyId: true } }) : null;
    const application = parsed.data.corporateBookingApplicationId ? await prisma.corporateBookingApplication.findFirst({ where: { id: parsed.data.corporateBookingApplicationId, organizationId, propertyId: { in: [...propertyIds] }, status: 'PENDING' }, select: { id: true, propertyId: true } }) : null;
    const identity = account || application;
    if (!identity) return errorResponse('NOT_FOUND', 'Corporate identity not found', 404);
    if (!(await hasPermission(session.user.id, identity.propertyId, 'corporate_account:edit'))) return errorResponse('FORBIDDEN', 'Missing corporate account permission', 403);

    const roomTypes = await prisma.roomType.findMany({
      where: { propertyId: identity.propertyId, isActive: true, deletedAt: null, id: { in: parsed.data.proposedRates.map(rate => rate.roomTypeId) } },
      select: { id: true },
    });
    if (roomTypes.length !== new Set(parsed.data.proposedRates.map(rate => rate.roomTypeId)).size) return errorResponse('BAD_REQUEST', 'Every proposed rate must reference an active room type in this property', 400);

    const request = await prisma.corporateRateNegotiationRequest.create({
      data: {
        organizationId,
        propertyId: identity.propertyId,
        corporateAccountId: account?.id,
        corporateBookingApplicationId: application?.id,
        requestedByType: 'STAFF',
        requestedById: session.user.id,
        reference: parsed.data.reference,
        requestedTerms: parsed.data.requestedTerms as any,
        proposedRates: parsed.data.proposedRates,
        status: 'SUBMITTED',
      },
    });
    return successResponse({ id: request.id, status: request.status }, 201);
  } catch {
    return errorResponse('INTERNAL_ERROR', 'Unable to submit rate negotiation request', 500);
  }
}
