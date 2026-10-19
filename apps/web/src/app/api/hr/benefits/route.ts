import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

const MANAGEMENT_ROLES = ['GENERAL_MANAGER', 'HOTEL_MANAGER', 'CEO', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'OWNER', 'FINANCIAL_CONTROLLER'];
const HR_BENEFIT_REVIEW_ROLES = ['HR_MANAGER', 'HR_OFFICER', 'PAYROLL_OFFICER', 'ADMIN', 'SUPER_ADMIN', 'OWNER'];

function canReviewBenefits(authContext: any) {
  return HR_BENEFIT_REVIEW_ROLES.includes(authContext.role) || HrAuthorizationService.can(authContext, 'hr.benefits.manage');
}

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const canViewAllBenefits = HrAuthorizationService.can(authContext, 'hr.employee.view') || MANAGEMENT_ROLES.includes(authContext.role);
    const canReview = canReviewBenefits(authContext);
    const canViewBenefitDetails = authContext.canViewSensitive || canReview || MANAGEMENT_ROLES.includes(authContext.role);

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const staffWhere: any = {};
    if (organizationId) staffWhere.organizationId = organizationId;
    if (propertyId) staffWhere.propertyAccess = { has: propertyId };
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) staffWhere.department = authContext.department;
    if (!canViewAllBenefits) staffWhere.userId = authContext.userId;

    const [loans, advances] = await Promise.all([
      prisma.employeeLoan.findMany({
        where: { staff: staffWhere },
        include: {
          staff: {
            select: { id: true, userId: true, firstName: true, lastName: true, department: true, position: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salaryAdvance.findMany({
        where: { staff: staffWhere },
        include: {
          staff: {
            select: { id: true, userId: true, firstName: true, lastName: true, department: true, position: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      loans: loans.map((l) => ({
        id: l.id,
        staffId: l.staffId,
        staffName: `${l.staff.firstName || ''} ${l.staff.lastName || ''}`.trim(),
        department: l.staff.department,
        position: l.staff.position,
        loanNumber: l.loanNumber,
        principalAmount: canViewBenefitDetails || l.staff.userId === authContext.userId ? Number(l.principalAmount) : null,
        interestRate: canViewBenefitDetails || l.staff.userId === authContext.userId ? Number(l.interestRate) : null,
        balanceRemaining: canViewBenefitDetails || l.staff.userId === authContext.userId ? Number(l.remainingBalance) : null,
        monthlyDeduction: canViewBenefitDetails || l.staff.userId === authContext.userId ? Number(l.monthlyDeduction) : null,
        tenorMonths: l.termMonths,
        disbursementDate: l.disbursementDate,
        reason: l.reason,
        status: l.status,
        requestedBy: l.requestedBy,
        hrApprovedBy: l.hrApprovedBy,
        hrApprovedAt: l.hrApprovedAt,
        approvedBy: l.approvedBy,
        approvedAt: l.approvedAt,
        rejectionReason: l.rejectionReason,
        createdAt: l.createdAt,
      })),
      advances: advances.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        staffName: `${a.staff.firstName || ''} ${a.staff.lastName || ''}`.trim(),
        department: a.staff.department,
        position: a.staff.position,
        amount: canViewBenefitDetails || a.staff.userId === authContext.userId ? Number(a.amount) : null,
        reason: a.reason,
        status: a.status,
        requestedBy: a.requestedBy,
        hrApprovedBy: a.hrApprovedBy,
        hrApprovedAt: a.hrApprovedAt,
        approvedBy: a.approvedBy,
        approvedAt: a.approvedAt,
        rejectionReason: a.rejectionReason,
        createdAt: a.createdAt,
      })),
      role: authContext.role,
      canApprove: MANAGEMENT_ROLES.includes(authContext.role),
      canReviewBenefits: canReview,
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get benefits data:', error);
    return NextResponse.json({ error: 'Failed to retrieve benefits records' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;
    const body = await req.json();
    const { action } = body;

    if (action === 'CREATE_LOAN') {
      const canManage = HrAuthorizationService.can(authContext, 'hr.employee.manage');
      const { principalAmount, tenorMonths = 6, reason, source = 'SELF_SERVICE' } = body;
      const staffId = body.staffId || (await prisma.staff.findFirst({ where: { userId: authContext.userId, organizationId, isActive: true }, select: { id: true } }))?.id;

      // Verify staff belongs to tenant
      const staff = await prisma.staff.findFirst({
        where: HrAuthorizationService.staffScope(authContext, { id: staffId, isActive: true, deletedAt: null }),
      });
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
      }

      const principal = Number(principalAmount) || 0;
      const termMonths = parseInt(tenorMonths, 10) || 6;
      if (principal <= 0 || termMonths < 1 || termMonths > 60) return NextResponse.json({ error: 'Enter a valid loan amount and repayment term' }, { status: 400 });
      if (!canManage && staff.userId !== authContext.userId) return NextResponse.json({ error: 'Employees may only apply for themselves' }, { status: 403 });
      const monthlyDeduction = Math.round((principal / termMonths) * 100) / 100;
      const loanNumber = `LN-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const targetPropertyId = propertyId || staff.propertyAccess[0];

      if (!targetPropertyId) {
        return NextResponse.json({ error: 'Staff has no associated property' }, { status: 400 });
      }

      const loan = await prisma.employeeLoan.create({
        data: {
          propertyId: targetPropertyId,
          staffId,
          loanNumber,
          principalAmount: principal,
          remainingBalance: principal,
          termMonths,
          monthlyDeduction,
          disbursementDate: new Date(),
          reason: reason?.trim() || 'Staff assistance loan',
          status: source === 'HR_ADMIN' && canManage ? 'MANAGER_REVIEW' : 'PENDING',
          ...(source === 'HR_ADMIN' && canManage ? { hrApprovedBy: authContext.userId, hrApprovedAt: new Date() } : {}),
          requestedBy: authContext.userId,
        },
      });
      return NextResponse.json({ success: true, data: loan }, { status: 201 });
    }

    if (action === 'CREATE_ADVANCE') {
      const { staffId, amount, reason, source = 'SELF_SERVICE' } = body;
      const canManage = HrAuthorizationService.can(authContext, 'hr.employee.manage');
      const staff = await prisma.staff.findFirst({
        where: HrAuthorizationService.staffScope(authContext, { id: staffId, isActive: true, deletedAt: null }),
      });
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
      }

      if (staff.userId !== authContext.userId) {
        if (!HrAuthorizationService.can(authContext, 'hr.employee.manage')) {
          return NextResponse.json({ error: 'Forbidden: Employees may only submit advances for themselves' }, { status: 403 });
        }
      }

      const targetPropertyId = propertyId || staff.propertyAccess[0];
      if (!targetPropertyId) {
        return NextResponse.json({ error: 'Staff has no associated property' }, { status: 400 });
      }

      const advanceAmount = Number(amount);
      if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
        return NextResponse.json({ error: 'Enter a valid salary advance amount' }, { status: 400 });
      }

      const advance = await prisma.salaryAdvance.create({
        data: {
          propertyId: targetPropertyId,
          staffId,
          amount: advanceAmount,
          reason: reason?.trim() || 'Mid-month salary advance',
          status: source === 'HR_ADMIN' && canManage ? 'MANAGER_REVIEW' : 'PENDING',
          ...(source === 'HR_ADMIN' && canManage ? { hrApprovedBy: authContext.userId, hrApprovedAt: new Date() } : {}),
          requestedBy: authContext.userId,
        },
      });
      return NextResponse.json({ success: true, data: advance }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid benefits action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Benefits operation failed:', error);
    return NextResponse.json({ error: 'Failed to process benefits request' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const { action, id, reason } = body;
    const isHrAction = ['HR_APPROVE_LOAN', 'HR_REJECT_LOAN', 'HR_APPROVE_ADVANCE', 'HR_REJECT_ADVANCE'].includes(action);
    const canApprove = MANAGEMENT_ROLES.includes(authContext.role);
    if (!isHrAction && !canApprove) return NextResponse.json({ error: 'Only an independent General Manager or authorized executive may approve benefits.' }, { status: 403 });
    if (isHrAction && !canReviewBenefits(authContext)) return NextResponse.json({ error: 'Only an authorized HR reviewer may review benefits.' }, { status: 403 });
    if (!id || !['HR_APPROVE_LOAN', 'HR_REJECT_LOAN', 'HR_APPROVE_ADVANCE', 'HR_REJECT_ADVANCE', 'APPROVE_LOAN', 'REJECT_LOAN', 'APPROVE_ADVANCE', 'REJECT_ADVANCE'].includes(action)) {
      return NextResponse.json({ error: 'A valid benefit approval action and record id are required.' }, { status: 400 });
    }
    const isLoan = action.endsWith('LOAN');
    const approving = action.includes('APPROVE');
    if (!approving && String(reason || '').trim().length < 10) {
      return NextResponse.json({ error: 'A detailed rejection reason is required.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let result: any;
      let resource: 'EmployeeLoan' | 'SalaryAdvance';
      if (isLoan) {
        resource = 'EmployeeLoan';
        const loan = await tx.employeeLoan.findFirst({ where: { id, propertyId: authContext.propertyId } });
        if (!loan) throw new Error('Loan request not found.');
        const expectedStatus = isHrAction ? 'PENDING' : 'MANAGER_REVIEW';
        if (loan.status !== expectedStatus) throw new Error(`Loan request is not awaiting ${isHrAction ? 'HR' : 'manager'} review.`);
        if (loan.requestedBy === authContext.userId) throw new Error('Maker-checker violation: the requester cannot approve their own loan.');
        result = await tx.employeeLoan.update({ where: { id }, data: approving ? {
          ...(isHrAction ? { status: 'MANAGER_REVIEW', hrApprovedBy: authContext.userId, hrApprovedAt: new Date() } : { status: 'ACTIVE', approvedBy: authContext.userId, approvedAt: new Date() }),
          rejectionReason: null, rejectedBy: null, rejectedAt: null,
        } : {
          status: 'REJECTED', rejectedBy: authContext.userId, rejectedAt: new Date(), rejectionReason: String(reason).trim(),
        } });
      } else {
        resource = 'SalaryAdvance';
        const advance = await tx.salaryAdvance.findFirst({ where: { id, propertyId: authContext.propertyId } });
        if (!advance) throw new Error('Salary advance request not found.');
        const expectedStatus = isHrAction ? 'PENDING' : 'MANAGER_REVIEW';
        if (advance.status !== expectedStatus) throw new Error(`Salary advance is not awaiting ${isHrAction ? 'HR' : 'manager'} review.`);
        if (advance.requestedBy === authContext.userId) throw new Error('Maker-checker violation: the requester cannot approve their own advance.');
        result = await tx.salaryAdvance.update({ where: { id }, data: approving ? {
          ...(isHrAction ? { status: 'MANAGER_REVIEW', hrApprovedBy: authContext.userId, hrApprovedAt: new Date() } : { status: 'APPROVED', approvedBy: authContext.userId, approvedAt: new Date() }),
          rejectionReason: null, rejectedBy: null, rejectedAt: null,
        } : {
          status: 'REJECTED', rejectedBy: authContext.userId, rejectedAt: new Date(), rejectionReason: String(reason).trim(),
        } });
      }
      await tx.auditLog.create({ data: {
        organizationId: authContext.organizationId,
        propertyId: authContext.propertyId,
        userId: authContext.userId,
        action: approving ? 'HR_BENEFIT_APPROVED' : 'HR_BENEFIT_REJECTED',
        resource,
        resourceId: id,
        requestId: randomUUID(),
        newValue: { status: result.status, reason: reason?.trim() || null },
      } });
      return result;
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const message = error.message || 'Failed to update benefit request';
    return NextResponse.json({ error: message }, { status: /Unauthorized/i.test(message) ? 401 : /Forbidden|maker-checker/i.test(message) ? 403 : 400 });
  }
}
