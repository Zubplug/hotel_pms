import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { propertyIds } = await requireOrganizationContext((session.user as any).id);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    
    if (propertyId && !propertyIds.includes(propertyId)) {
        return errorResponse('FORBIDDEN', 'Forbidden property access', 403);
    }
    
    const where: any = propertyId 
      ? { propertyId, isActive: true } 
      : { propertyId: { in: propertyIds }, isActive: true };

    const accounts = await prisma.corporateAccount.findMany({ 
        where, 
        orderBy: { name: 'asc' },
        include: { ratePlan: true, cityLedgerAccount: true }
    });
    
    return successResponse(accounts);
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const body = await req.json();
    
    if (!body.propertyId || !propertyIds.includes(body.propertyId)) {
        return errorResponse('FORBIDDEN', 'Forbidden property access', 403);
    }

    const account = await prisma.corporateAccount.create({ 
        data: {
            organizationId,
            propertyId: body.propertyId,
            name: body.name,
            code: body.code,
            contactPerson: body.contactPerson,
            contactEmail: body.contactEmail,
            contactPhone: body.contactPhone,
            creditLimit: body.creditLimit || 0,
            exemptFromHighBalance: body.exemptFromHighBalance || false,
            depositPolicy: body.depositPolicy || "STANDARD",
            ratePlanId: body.ratePlanId,
            cityLedgerAccountId: body.cityLedgerAccountId
        } 
    });

    await createAuditLog({
      organizationId, 
      propertyId: body.propertyId, 
      userId: session.user.id,
      action: 'CREATE', 
      resource: 'corporate_account', 
      resourceId: account.id, 
      newValue: account,
    });
    
    return successResponse(account, 201);
  } catch (err: any) {
    if (err.code === 'P2002') {
        return errorResponse('CONFLICT', 'A corporate account with this code already exists for this property.', 409);
    }
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
