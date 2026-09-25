import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { hasPermission } from '@/lib/permissions';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const { id } = await params;

    const account = await prisma.corporateAccount.findUnique({
        where: { id }
    });

    if (!account || !propertyIds.includes(account.propertyId)) {
        return errorResponse('NOT_FOUND', 'Corporate account not found or access denied', 404);
    }
    const body = await req.json();

    const canEdit = await hasPermission(session.user.id, account.propertyId, 'corporate_account:edit');
    if (!canEdit) {
        return errorResponse('FORBIDDEN', 'Missing required permission: corporate_account:edit', 403);
    }
    
    const allowedProfileFields = ['name', 'code', 'contactPerson', 'contactEmail', 'contactPhone', 'ratePlanId'];
    const allowedFinancialFields = ['creditLimit', 'depositPolicy', 'exemptFromHighBalance'];
    const unknownFields = Object.keys(body).filter(key => ![...allowedProfileFields, ...allowedFinancialFields, 'reason'].includes(key));
    if (unknownFields.length) return errorResponse('BAD_REQUEST', `Unsupported field: ${unknownFields[0]}`, 400);

    const data: Record<string, unknown> = {};
    for (const field of allowedProfileFields) {
      if (field in body) data[field] = typeof body[field] === 'string' ? body[field].trim() || null : body[field];
    }
    if ('name' in data && !data.name) return errorResponse('BAD_REQUEST', 'Company name is required', 400);
    if ('code' in data) {
      if (!data.code) return errorResponse('BAD_REQUEST', 'Corporate code is required', 400);
      data.code = String(data.code).toUpperCase();
    }

    const financialChange = ('creditLimit' in body && Number(body.creditLimit) !== Number(account.creditLimit))
      || ('depositPolicy' in body && body.depositPolicy !== account.depositPolicy)
      || ('exemptFromHighBalance' in body && Boolean(body.exemptFromHighBalance) !== account.exemptFromHighBalance);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (financialChange && reason.length < 5) {
      return errorResponse('BAD_REQUEST', 'A reason of at least 5 characters is required for financial-control changes', 400);
    }

    if ('creditLimit' in body) {
      const value = Number(body.creditLimit);
      if (!Number.isFinite(value) || value < 0) return errorResponse('BAD_REQUEST', 'Credit limit must be a non-negative number', 400);
      data.creditLimit = value;
    }
    if ('depositPolicy' in body) {
      if (!['WAIVED', 'STANDARD'].includes(body.depositPolicy)) return errorResponse('BAD_REQUEST', 'Invalid deposit policy', 400);
      data.depositPolicy = body.depositPolicy;
    }
    if ('exemptFromHighBalance' in body) data.exemptFromHighBalance = Boolean(body.exemptFromHighBalance);

    // Check specific capabilities for financial fields
    if (('creditLimit' in body && Number(body.creditLimit) !== Number(account.creditLimit)) || ('exemptFromHighBalance' in body && Boolean(body.exemptFromHighBalance) !== account.exemptFromHighBalance)) {
        const canChangeCreditLimit = await hasPermission(session.user.id, account.propertyId, 'corporate_account:change_credit_limit');
        if (!canChangeCreditLimit) {
            return errorResponse('FORBIDDEN', 'Missing required permission: corporate_account:change_credit_limit', 403);
        }
    }

    if ('depositPolicy' in body && body.depositPolicy !== account.depositPolicy) {
        const canChangeDepositPolicy = await hasPermission(session.user.id, account.propertyId, 'corporate_account:change_deposit_policy');
        if (!canChangeDepositPolicy) {
            return errorResponse('FORBIDDEN', 'Missing required permission: corporate_account:change_deposit_policy', 403);
        }
    }

    const updatedAccount = await prisma.$transaction(async tx => {
      const updated = await tx.corporateAccount.update({ where: { id }, data });
      await tx.auditLog.create({ data: {
        organizationId, propertyId: account.propertyId, userId: session.user.id,
        action: financialChange ? 'FINANCIAL_OVERRIDE' : 'UPDATE', resource: 'corporate_account', resourceId: account.id,
        previousValue: JSON.parse(JSON.stringify(account)),
        newValue: JSON.parse(JSON.stringify({ account: updated, reason: financialChange ? reason : undefined })),
        requestId: crypto.randomUUID(),
      } });
      return updated;
    });
    
    return successResponse(updatedAccount);
  } catch (err: any) {
    if (err.code === 'P2002') {
        return errorResponse('CONFLICT', 'A corporate account with this code already exists for this property.', 409);
    }
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { propertyIds, organizationId } = await requireOrganizationContext((session.user as any).id);
    const { id } = await params;
    
    const account = await prisma.corporateAccount.findUnique({
        where: { id }
    });

    if (!account || !propertyIds.includes(account.propertyId)) {
        return errorResponse('NOT_FOUND', 'Corporate account not found or access denied', 404);
    }
    if (!account.isActive) return errorResponse('CONFLICT', 'Corporate account is already inactive', 409);

    const canDeactivate = await hasPermission(session.user.id, account.propertyId, 'corporate_account:deactivate');
    if (!canDeactivate) {
        return errorResponse('FORBIDDEN', 'Missing required permission: corporate_account:deactivate', 403);
    }

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 5) return errorResponse('BAD_REQUEST', 'A reason of at least 5 characters is required for deactivation', 400);

    await prisma.$transaction(async tx => {
      await tx.corporateAccount.update({ where: { id }, data: { isActive: false } });
      await tx.auditLog.create({ data: {
        organizationId, propertyId: account.propertyId, userId: session.user.id,
        action: 'DEACTIVATE', resource: 'corporate_account', resourceId: account.id,
        previousValue: JSON.parse(JSON.stringify({ isActive: account.isActive })),
        newValue: JSON.parse(JSON.stringify({ isActive: false, reason })), requestId: crypto.randomUUID(),
      } });
    });
    
    return successResponse({ success: true });
  } catch (err) {
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

/** @deprecated Use POST /:id with a reason. Kept unavailable intentionally. */
export async function DELETE() {
  return errorResponse('METHOD_NOT_ALLOWED', 'Use POST to deactivate a corporate account and provide a reason', 405);
}
