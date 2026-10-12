import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { PiiMaskingService } from '@/lib/services/pii-masking-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const userId = authContext.userId;
    const organizationId = authContext.organizationId;

    // Find staff record for user strictly within organization
    const whereStaff: any = {
      deletedAt: null,
      userId,
    };
    if (organizationId) {
      whereStaff.organizationId = organizationId;
    }

    const staff = await prisma.staff.findFirst({
      where: whereStaff,
      include: {
        employeeProfile: true,
        salaryStructure: true,
        payslips: {
          include: {
            payrollPeriod: true,
            components: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
        leaveApplications: {
          include: { leaveType: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        leaveAllocations: {
          include: { leaveType: true },
        },
        shiftRosters: {
          where: {
            date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          include: { shift: true },
          orderBy: { date: 'asc' },
          take: 7,
        },
        employeeLoans: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!staff) {
      return NextResponse.json({
        isStaff: false,
        message: 'No employee record associated with current login.',
      });
    }

    const rawAcct = staff.salaryStructure?.bankAccountNumber;
    const rawRsa = staff.salaryStructure?.pensionNumber;
    const rawTin = staff.employeeProfile?.tin;

    return NextResponse.json({
      isStaff: true,
      staff: {
        id: staff.id,
        name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email,
        email: staff.email,
        phone: staff.phone,
        department: staff.department || 'General',
        position: staff.position || 'Staff',
        employeeCode: staff.employeeId || `EMP-${staff.id.slice(0, 4).toUpperCase()}`,
        hireDate: staff.hiredAt || staff.createdAt,
        status: staff.employeeProfile?.status || (staff.isActive ? 'ACTIVE' : 'INACTIVE'),
        bankName: staff.salaryStructure?.bankName || 'Not configured',
        bankAccountNumber: PiiMaskingService.maskAccountNumber(rawAcct),
        baseSalary: Number(staff.salaryStructure?.basicSalary || 0),
        pfaName: staff.salaryStructure?.pensionFundAdmin || 'Not configured',
        rsaPin: rawRsa ? `PEN-******${rawRsa.slice(-4)}` : '',
        taxId: PiiMaskingService.maskTin(rawTin),
        payslips: staff.payslips.map((ps) => ({
          id: ps.id,
          periodName: ps.payrollPeriod.name,
          grossPay: Number(ps.grossEarnings),
          deductions: Number(ps.totalDeductions),
          netPay: Number(ps.netPay),
          status: ps.status,
          components: ps.components.map((c) => ({
            name: c.name,
            type: c.type,
            amount: Number(c.amount),
          })),
        })),
        leaves: staff.leaveApplications.map((la) => ({
          id: la.id,
          leaveType: la.leaveType.name,
          startDate: la.startDate,
          endDate: la.endDate,
          days: la.totalDays,
          status: la.status,
        })),
        leaveBalances: staff.leaveAllocations.map((al) => ({
          leaveType: al.leaveType.name,
          remaining: al.balanceDays,
          allocated: al.entitledDays,
        })),
        upcomingShifts: staff.shiftRosters.map((s) => ({
          id: s.id,
          date: s.date,
          shiftName: s.shift.name,
          times: `${s.shift.startTime} - ${s.shift.endTime}`,
          crossesMidnight: s.shift.isOvernight,
        })),
        activeLoans: staff.employeeLoans.map((l) => ({
          id: l.id,
          principal: Number(l.principalAmount),
          balance: Number(l.remainingBalance),
          monthly: Number(l.monthlyDeduction),
        })),
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get self-service data:', error);
    return NextResponse.json({ error: 'Failed to retrieve employee portal data' }, { status: 500 });
  }
}
