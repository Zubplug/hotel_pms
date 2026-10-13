import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { requireOrganizationContext } from '@/lib/organization-access';
import { EmployeeExpenseReimbursementService, reimbursementCanSeeAll, reimbursementStageForRole } from '@/lib/services/employee-expense-reimbursement-service';

const CASHIER_ROLES = ['GENERAL_CASHIER', 'CASHIER', 'FRONT_DESK_CASHIER'];

function errorResponse(error: any) {
  const message = error?.message || 'Unable to process reimbursement request';
  const status = /unauthorized/i.test(message) ? 401 : /forbidden|cannot|only|not found|not awaiting|insufficient|configure|mapped|required|unavailable/i.test(message) ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const showAll = reimbursementCanSeeAll(context.role);
    const [claims, bankAccounts, property] = await Promise.all([prisma.expenseClaim.findMany({
      where: { propertyId: context.propertyId, ...(showAll ? {} : { staff: { userId: context.userId } }) },
      include: { staff: { select: { id: true, userId: true, firstName: true, lastName: true, employeeId: true, department: true, position: true } } },
      orderBy: { createdAt: 'desc' }, take: 300,
    }), prisma.cashAccount.findMany({ where: { propertyId: context.propertyId, type: 'BANK_ACCOUNT', isActive: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true, bankName: true, accountNumber: true, balance: true } }), prisma.property.findUnique({ where: { id: context.propertyId }, select: { autoBankReimbursementEnabled: true } })]);
    return NextResponse.json({ bankAccounts: bankAccounts.map((account) => ({ ...account, balance: Number(account.balance) })), claims: claims.map((claim) => ({
      id: claim.id, claimNumber: claim.claimNumber, staffId: claim.staffId,
      staffName: `${claim.staff.firstName || ''} ${claim.staff.lastName || ''}`.trim(), employeeId: claim.staff.employeeId,
      department: claim.staff.department, position: claim.staff.position, category: claim.category,
      amount: showAll || claim.staff.userId === context.userId ? Number(claim.amount) : null,
      currency: claim.currency, receiptUrl: claim.receiptUrl, description: claim.description, status: claim.status,
      rejectionReason: claim.rejectionReason, paymentMethod: claim.paymentMethod, paymentReference: claim.paymentReference,
      requestedPaymentMethod: claim.requestedPaymentMethod, autoPaymentStatus: claim.autoPaymentStatus,
      createdAt: claim.createdAt, paidAt: claim.paidAt,
    })), autoBankReimbursementEnabled: Boolean(property?.autoBankReimbursementEnabled), role: context.role, stage: reimbursementStageForRole(context.role) || (CASHIER_ROLES.includes(context.role) ? 'PAYMENT' : null) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const staff = await prisma.staff.findFirst({ where: { id: body.staffId || undefined, userId: body.staffId ? undefined : context.userId, organizationId: context.organizationId, isActive: true, deletedAt: null, ...(context.propertyId ? { propertyAccess: { has: context.propertyId } } : {}) } });
    if (!staff) return NextResponse.json({ error: 'Employee record not found.' }, { status: 404 });
    if (staff.userId !== context.userId && !reimbursementCanSeeAll(context.role)) return NextResponse.json({ error: 'Employees may submit reimbursements only for themselves.' }, { status: 403 });
    const amount = Number(body.amount);
    const description = String(body.description || '').trim();
    const category = String(body.category || 'OTHER').trim().toUpperCase();
    const requestedPaymentMethod = String(body.requestedPaymentMethod || 'CASH').trim().toUpperCase();
    if (!['CASH', 'BANK_TRANSFER'].includes(requestedPaymentMethod)) return NextResponse.json({ error: 'Choose Cash or Bank Transfer.' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0 || !description) return NextResponse.json({ error: 'Category, a positive amount, and a clear business description are required.' }, { status: 400 });
    const count = await prisma.expenseClaim.count();
    const claim = await prisma.expenseClaim.create({ data: { propertyId: context.propertyId, staffId: staff.id, claimNumber: `CLM-${String(count + 1).padStart(6, '0')}`, category, amount, currency: String(body.currency || 'NGN'), receiptUrl: body.receiptUrl ? String(body.receiptUrl).trim() : null, description, requestedPaymentMethod, status: 'HR_REVIEW', autoPaymentStatus: requestedPaymentMethod === 'BANK_TRANSFER' ? 'PENDING' : null } });
    return NextResponse.json({ success: true, claim }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    if (body.action === 'SET_AUTO_BANK') {
      if (!['HR_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(context.role)) return NextResponse.json({ error: 'Only HR management can change automatic bank reimbursement.' }, { status: 403 });
      const enabled = Boolean(body.enabled);
      const property = await prisma.property.update({ where: { id: context.propertyId }, data: { autoBankReimbursementEnabled: enabled }, select: { autoBankReimbursementEnabled: true } });
      return NextResponse.json({ success: true, autoBankReimbursementEnabled: property.autoBankReimbursementEnabled });
    }
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'Claim id is required.' }, { status: 400 });
    if (body.action === 'approve') {
      const claim = await EmployeeExpenseReimbursementService.approve(id, context);
      if (claim.status === 'APPROVED_FOR_PAYMENT') {
        // The service will automatically settle eligible bank-transfer claims;
        // cash and disabled/unconfigured bank claims remain cashier work.
        const tenant = await requireOrganizationContext(context.userId);
        const settled = await EmployeeExpenseReimbursementService.autoSettleBankClaim(tenant, id);
        return NextResponse.json({ success: true, claim: settled || claim });
      }
      return NextResponse.json({ success: true, claim });
    }
    if (body.action === 'reject') return NextResponse.json({ success: true, claim: await EmployeeExpenseReimbursementService.reject(id, context, String(body.reason || '')) });
    if (body.action === 'pay') {
      if (!CASHIER_ROLES.includes(context.role) && !context.isSuperAdmin) return NextResponse.json({ error: 'Only the General Cashier can pay reimbursements.' }, { status: 403 });
      const tenant = await requireOrganizationContext(context.userId);
      return NextResponse.json({ success: true, claim: await EmployeeExpenseReimbursementService.pay(tenant, id, { method: body.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH', bankAccountId: body.bankAccountId, paymentReference: body.paymentReference }) });
    }
    return NextResponse.json({ error: 'Action must be approve, reject, or pay.' }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}
