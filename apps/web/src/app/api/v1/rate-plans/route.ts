import { NextRequest } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId') || propertyIds[0];
    const type = searchParams.get('type');

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Property ID required', 400);
    }

    if (!propertyIds.includes(propertyId)) {
        return errorResponse('FORBIDDEN', 'Forbidden property access', 403);
    }

    const whereClause: any = {
      propertyId,
      isActive: true,
    };
    if (type) {
      whereClause.type = type;
    }

    const includeRates = searchParams.get('includeRates') === 'true';

    const selectObj: any = {
      id: true,
      name: true,
      code: true,
    };

    if (includeRates) {
      selectObj.rates = {
        select: {
          id: true,
          amount: true,
          currency: true,
          roomType: {
            select: {
              id: true,
              name: true,
              baseRate: true,
            }
          }
        }
      };
    }

    const ratePlans = await prisma.ratePlan.findMany({
      where: whereClause,
      select: selectObj,
      orderBy: { name: 'asc' },
    });

    return successResponse(ratePlans);
  } catch (error: any) {
    console.error('[RATE_PLANS_GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const body = await req.json();
    let { name, code, rates, currency, propertyId } = body;

    propertyId = propertyId || propertyIds[0];
    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Property ID required', 400);
    }
    
    // Check property context access
    if (!propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'Unauthorized property access', 403);
    }

    // Check rate management permissions
    const canCreateRatePlan = await hasPermission(session.user.id, propertyId, 'rate_plan:create');
    if (!canCreateRatePlan) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to create rate plans', 403);
    }

    if (!name || typeof name !== 'string') return errorResponse('BAD_REQUEST', 'Name is required', 400);
    if (!code || typeof code !== 'string') return errorResponse('BAD_REQUEST', 'Code is required', 400);
    
    code = code.trim().toUpperCase();
    
    if (!Array.isArray(rates) || rates.length === 0) {
      return errorResponse('BAD_REQUEST', 'At least one room type rate must be provided', 400);
    }

    const uniqueRoomTypes = new Set<string>();
    const validRates: { roomTypeId: string, amount: number }[] = [];

    for (const rate of rates) {
      if (!rate.roomTypeId || typeof rate.roomTypeId !== 'string') {
        return errorResponse('BAD_REQUEST', 'Invalid roomTypeId in rates array', 400);
      }
      const parsedAmount = Number(rate.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return errorResponse('BAD_REQUEST', `Amount for room type ${rate.roomTypeId} must be greater than 0`, 400);
      }
      if (uniqueRoomTypes.has(rate.roomTypeId)) {
        return errorResponse('BAD_REQUEST', `Duplicate roomTypeId ${rate.roomTypeId} in request`, 400);
      }
      uniqueRoomTypes.add(rate.roomTypeId);
      validRates.push({ roomTypeId: rate.roomTypeId, amount: parsedAmount });
    }

    if (!currency || typeof currency !== 'string') return errorResponse('BAD_REQUEST', 'Currency is required', 400);

    // Enforce unique rate code within property
    const existingRatePlan = await prisma.ratePlan.findFirst({
      where: { propertyId, code }
    });
    if (existingRatePlan) {
      return errorResponse('CONFLICT', `A rate plan with code ${code} already exists for this property.`, 409);
    }

    // Validate that provided room types exist and are active for this property
    const activeRoomTypes = await prisma.roomType.findMany({
      where: { propertyId, isActive: true, id: { in: Array.from(uniqueRoomTypes) } },
      select: { id: true }
    });

    if (activeRoomTypes.length !== uniqueRoomTypes.size) {
      return errorResponse('BAD_REQUEST', 'One or more provided room types are invalid, inactive, or do not belong to this property.', 400);
    }

    // Create RatePlan + Rates transaction
    const newRatePlan = await prisma.$transaction(async (tx) => {
      const plan = await tx.ratePlan.create({
        data: {
          name,
          code,
          propertyId,
          type: 'CORPORATE',
          isActive: true,
          isPublic: false,
          minStay: 1,
        }
      });

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const ratePromises = validRates.map((rt) => 
        tx.rate.create({
          data: {
            ratePlanId: plan.id,
            roomTypeId: rt.roomTypeId,
            propertyId,
            amount: rt.amount,
            currency,
            effectiveFrom: today,
            dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
          }
        })
      );
      
      await Promise.all(ratePromises);
      return plan;
    });

    return successResponse(newRatePlan, 201);
  } catch (error: any) {
    console.error('[RATE_PLANS_POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Internal error', 500);
  }
}
