import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    // Exporting banking schedules requires payroll release permission
    HrAuthorizationService.assertPermission(authContext, 'hr.payroll.release');

    const { id } = await params;

    // Strictly scope query by tenant organization and property
    const whereClause: any = { id };
    if (authContext.organizationId) {
      whereClause.property = { organizationId: authContext.organizationId };
    }
    if (authContext.propertyId) {
      whereClause.propertyId = authContext.propertyId;
    }

    const period = await prisma.payrollPeriod.findFirst({
      where: whereClause,
      include: {
        property: true,
        payslips: {
          include: {
            staff: {
              include: {
                employeeProfile: true,
              },
            },
          },
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found or inaccessible' }, { status: 404 });
    }

    // Require batch to be at least APPROVED or PAID before releasing bank schedule
    if (period.status !== 'APPROVED' && period.status !== 'PAID') {
      return NextResponse.json(
        { error: `Cannot export bank schedule for unapproved payroll batch (current status: ${period.status})` },
        { status: 400 }
      );
    }

    // CSV Injection (Formula Injection) Sanitizer:
    // If a cell begins with =, +, -, @, \t, \r, spreadsheet software could execute it as code.
    const sanitizeCsvCell = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).trim();
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    // CBN / NIP Electronic Funds Transfer (EFT) standard CSV header
    const headers = [
      'Beneficiary Code',
      'Beneficiary Name',
      'Bank Name',
      'Account Number',
      'Amount (NGN)',
      'Payment Narration',
      'Bank Verification Number (BVN)',
      'Email',
    ];

    const rows = period.payslips.map((ps) => {
      const name = `${ps.staff.firstName || ''} ${ps.staff.lastName || ''}`.trim() || ps.staff.email;
      const code = ps.staff.employeeId || `EMP-${ps.staff.id.slice(0, 6)}`;
      const bankName = ps.bankName || 'Unknown Bank';
      const acctNum = ps.accountNumber || '';
      const bvn = ps.bvn || '';
      const amount = Number(ps.netPay).toFixed(2);
      const narration = `Salary ${period.name}`;

      return [
        sanitizeCsvCell(code),
        sanitizeCsvCell(name),
        sanitizeCsvCell(bankName),
        sanitizeCsvCell(acctNum),
        sanitizeCsvCell(amount),
        sanitizeCsvCell(narration),
        sanitizeCsvCell(bvn),
        sanitizeCsvCell(ps.staff.email),
      ];
    });

    const csvString = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    // Audit Log: Record bank payment schedule export in the batch approval trail
    const existingTrail = Array.isArray(period.approvalTrail) ? (period.approvalTrail as any[]) : [];
    const updatedTrail = [
      ...existingTrail,
      {
        stage: 'BANK_SCHEDULE_DOWNLOADED',
        userId: authContext.userId,
        timestamp: new Date().toISOString(),
        recordCount: period.payslips.length,
        ip: req.headers.get('x-forwarded-for') || 'local',
      },
    ];

    await prisma.$transaction(async (tx: any) => {
      await tx.payrollPeriod.update({
        where: { id, organizationId: authContext.organizationId, propertyId: authContext.propertyId },
        data: { approvalTrail: updatedTrail },
      });
      await tx.auditLog.create({
        data: {
          organizationId: authContext.organizationId,
          propertyId: authContext.propertyId,
          userId: authContext.userId,
          action: 'HR_BANK_SCHEDULE_EXPORTED',
          resource: 'PayrollPeriod',
          resourceId: id,
          newValue: { recordCount: period.payslips.length, paymentBatchRef: period.paymentBatchRef },
          ipAddress: (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim(),
          userAgent: req.headers.get('user-agent') || undefined,
          requestId: req.headers.get('x-request-id') || randomUUID(),
        },
      });
    });

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="NIP_Payment_Schedule_${period.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to export bank schedule:', error);
    return NextResponse.json({ error: 'Failed to generate bank payment schedule' }, { status: 500 });
  }
}
