import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const canViewAllBenefits = HrAuthorizationService.can(authContext, 'hr.employee.view');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const staffWhere: any = {};
    if (organizationId) staffWhere.organizationId = organizationId;
    if (propertyId) staffWhere.propertyAccess = { has: propertyId };
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) staffWhere.department = authContext.department;
    if (!canViewAllBenefits) staffWhere.userId = authContext.userId;

    const [loans, advances, claims] = await Promise.all([
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
      prisma.expenseClaim.findMany({
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
        principalAmount: authContext.canViewSensitive || l.staff.userId === authContext.userId ? Number(l.principalAmount) : null,
        balanceRemaining: authContext.canViewSensitive || l.staff.userId === authContext.userId ? Number(l.remainingBalance) : null,
        monthlyDeduction: authContext.canViewSensitive || l.staff.userId === authContext.userId ? Number(l.monthlyDeduction) : null,
        tenorMonths: l.termMonths,
        reason: l.reason,
        status: l.status,
        createdAt: l.createdAt,
      })),
      advances: advances.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        staffName: `${a.staff.firstName || ''} ${a.staff.lastName || ''}`.trim(),
        department: a.staff.department,
        amount: authContext.canViewSensitive || a.staff.userId === authContext.userId ? Number(a.amount) : null,
        reason: a.reason,
        status: a.status,
        createdAt: a.createdAt,
      })),
      claims: claims.map((c) => ({
        id: c.id,
        staffId: c.staffId,
        staffName: `${c.staff.firstName || ''} ${c.staff.lastName || ''}`.trim(),
        department: c.staff.department,
        category: c.category,
        amount: authContext.canViewSensitive || c.staff.userId === authContext.userId ? Number(c.amount) : null,
        description: c.description,
        status: c.status,
        createdAt: c.createdAt,
      })),
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
      const { principalAmount, tenorMonths = 6, reason } = body;
      const staffId = body.staffId || (await prisma.staff.findFirst({ where: { userId: authContext.userId, organizationId, isActive: true }, select: { id: true } }))?.id;

      // Verify staff belongs to tenant
      const staff = await prisma.staff.findFirst({
        where: HrAuthorizationService.staffScope(authContext, { id: staffId }),
      });
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
      }

      const principal = Number(principalAmount) || 0;
      const termMonths = parseInt(tenorMonths, 10) || 6;
      if (principal <= 0 || termMonths < 1 || termMonths > 60) return NextResponse.json({ error: 'Enter a valid loan amount and repayment term' }, { status: 400 });
      if (!canManage && staff.userId !== authContext.userId) return NextResponse.json({ error: 'Employees may only apply for themselves' }, { status: 403 });
      const monthlyDeduction = Math.round((principal / termMonths) * 100) / 100;
      const loanCount = await prisma.employeeLoan.count();
      const loanNumber = `LN-${String(loanCount + 1).padStart(5, '0')}`;
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
          status: canManage ? 'ACTIVE' : 'PENDING',
          approvedBy: canManage ? authContext.userId : null,
          approvedAt: canManage ? new Date() : null,
        },
      });
      return NextResponse.json({ success: true, data: loan }, { status: 201 });
    }

    if (action === 'CREATE_ADVANCE') {
      const { staffId, amount, reason } = body;
      const staff = await prisma.staff.findFirst({
        where: HrAuthorizationService.staffScope(authContext, { id: staffId }),
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

      const advance = await prisma.salaryAdvance.create({
        data: {
          propertyId: targetPropertyId,
          staffId,
          amount: Number(amount) || 0,
          reason: reason?.trim() || 'Mid-month salary advance',
          status: 'PENDING',
        },
      });
      return NextResponse.json({ success: true, data: advance }, { status: 201 });
    }

    if (action === 'CREATE_CLAIM') {
      const { staffId, category = 'OTHER', amount, description } = body;
      const staff = await prisma.staff.findFirst({
        where: HrAuthorizationService.staffScope(authContext, { id: staffId }),
      });
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
      }

      if (staff.userId !== authContext.userId) {
        if (!HrAuthorizationService.can(authContext, 'hr.employee.manage')) {
          return NextResponse.json({ error: 'Forbidden: Employees may only submit claims for themselves' }, { status: 403 });
        }
      }

      const claimCount = await prisma.expenseClaim.count();
      const claimNumber = `CLM-${String(claimCount + 1).padStart(5, '0')}`;
      const targetPropertyId = propertyId || staff.propertyAccess[0];

      if (!targetPropertyId) {
        return NextResponse.json({ error: 'Staff has no associated property' }, { status: 400 });
      }

      const claim = await prisma.expenseClaim.create({
        data: {
          propertyId: targetPropertyId,
          staffId,
          claimNumber,
          category,
          amount: Number(amount) || 0,
          description: description?.trim() || 'Staff operational reimbursement',
          status: 'SUBMITTED',
        },
      });
      return NextResponse.json({ success: true, data: claim }, { status: 201 });
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
