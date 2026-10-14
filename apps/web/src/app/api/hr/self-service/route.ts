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
            payout: true,
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
          where: { publicationStatus: 'PUBLISHED', status: { not: 'CANCELLED' }, date: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          include: { shift: true },
          orderBy: { date: 'asc' },
          take: 7,
        },
        employeeLoans: {
          where: { status: 'ACTIVE' },
        },
        attendanceRecords: {
          where: { date: { gte: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) } },
          orderBy: { date: 'desc' },
          take: 31,
        },
        missedPunchRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        serviceDeskTickets: {
          include: { messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        employeeChangeRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        employeeDocuments: {
          where: { isConfidential: false },
          orderBy: { createdAt: 'desc' },
          take: 20,
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
    const notifications = await prisma.notification.findMany({
      where: {
        organizationId,
        recipientType: 'staff',
        recipientId: staff.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, subject: true, body: true, category: true, action: true, readAt: true, createdAt: true },
    });

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
          paymentStatus: ps.payout?.status || ps.payrollPeriod.paymentStatus || 'UNPAID',
          paymentDate: ps.payrollPeriod.paymentDate,
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
        attendance: staff.attendanceRecords.map((record) => ({
          id: record.id,
          date: record.date,
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          lateMinutes: record.lateMinutes,
          earlyDepartureMinutes: record.earlyDepartureMinutes,
          overtimeMinutes: record.overtimeMinutes,
          status: record.status,
          verified: record.supervisorVerified,
        })),
        missedPunchRequests: staff.missedPunchRequests.map((request) => ({
          id: request.id,
          date: request.date,
          requestedIn: request.requestedIn,
          requestedOut: request.requestedOut,
          reason: request.reason,
          status: request.status,
          reviewerNotes: request.reviewerNotes,
        })),
        serviceRequests: staff.serviceDeskTickets.map((ticket) => ({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          category: ticket.category,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          messages: ticket.messages,
        })),
        profileChangeRequests: staff.employeeChangeRequests.map((request) => ({
          id: request.id,
          fieldName: request.fieldName,
          proposedValue: request.proposedValue,
          status: request.status,
          reviewerNotes: request.reviewerNotes,
          createdAt: request.createdAt,
        })),
        documents: staff.employeeDocuments.map((document) => ({
          id: document.id,
          title: document.title,
          category: document.category,
          downloadUrl: `/api/hr/self-service/documents/${document.id}`,
          expiresAt: document.expiresAt,
          createdAt: document.createdAt,
        })),
        notifications: notifications.map((notification) => ({
          ...notification,
          isRead: Boolean(notification.readAt),
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
