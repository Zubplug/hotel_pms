import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    
    const account = await prisma.corporateAccount.findUnique({
        where: { id: params.id }
    });

    if (!account || !propertyIds.includes(account.propertyId)) {
        return errorResponse('NOT_FOUND', 'Corporate account not found or access denied', 404);
    }

    const body = await req.json();
    
    // Prevent changing propertyId and organizationId
    delete body.propertyId;
    delete body.organizationId;
    delete body.id;

    const updatedAccount = await prisma.corporateAccount.update({ 
        where: { id: params.id },
        data: body
    });

    await createAuditLog({
      organizationId, 
      propertyId: account.propertyId, 
      userId: session.user.id,
      action: 'UPDATE', 
      resource: 'corporate_account', 
      resourceId: account.id, 
      oldValue: account,
      newValue: updatedAccount,
    });
    
    return successResponse(updatedAccount);
  } catch (err: any) {
    if (err.code === 'P2002') {
        return errorResponse('CONFLICT', 'A corporate account with this code already exists for this property.', 409);
    }
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    
    const account = await prisma.corporateAccount.findUnique({
        where: { id: params.id }
    });

    if (!account || !propertyIds.includes(account.propertyId)) {
        return errorResponse('NOT_FOUND', 'Corporate account not found or access denied', 404);
    }

    await prisma.corporateAccount.update({ 
        where: { id: params.id },
        data: { isActive: false }
    });

    await createAuditLog({
      organizationId, 
      propertyId: account.propertyId, 
      userId: session.user.id,
      action: 'DELETE', 
      resource: 'corporate_account', 
      resourceId: account.id, 
    });
    
    return successResponse({ success: true });
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
