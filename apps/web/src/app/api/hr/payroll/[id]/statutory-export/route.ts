import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.payroll.release');
    const { id } = await params;

    const period = await prisma.payrollPeriod.findFirst({
      where: { id, organizationId: context.organizationId, propertyId: context.propertyId },
      include: {
        payslips: {
          include: {
            staff: { select: { firstName: true, lastName: true, employeeId: true, department: true } },
            components: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!period) return NextResponse.json({ error: 'Payroll period not found' }, { status: 404 });
    if (period.status !== 'APPROVED' && period.status !== 'PAID') {
      return NextResponse.json({ error: 'Only approved payroll can produce a statutory schedule' }, { status: 400 });
    }

    const headers = ['Employee Code', 'Staff Name', 'Department', 'TIN', 'PFA', 'RSA PIN', 'Gross Pay', 'PAYE Tax', 'Pension Employee', 'Pension Employer', 'NHF', 'NSITF', 'ITF'];
    const rows = period.payslips.map((p) => {
      const component = (name: string) => Number(p.components.find((c) => c.name.includes(name))?.amount || 0).toFixed(2);
      return [
        p.staff.employeeId || p.staffId.slice(0, 8),
        `${p.staff.firstName || ''} ${p.staff.lastName || ''}`.trim(),
        p.staff.department || 'General',
        p.tin || '',
        p.pfaName || '',
        p.rsaPin || '',
        Number(p.grossEarnings).toFixed(2),
        Number(p.payeTax).toFixed(2),
        Number(p.pensionEmployee).toFixed(2),
        Number(p.pensionEmployer).toFixed(2),
        Number(p.nhf).toFixed(2),
        component('NSITF'),
        component('ITF'),
      ].map(csvCell).join(',');
    });

    return new NextResponse([headers.map(csvCell).join(','), ...rows].join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Statutory_${period.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to export statutory payroll schedule:', error);
    return NextResponse.json({ error: 'Failed to generate statutory payroll schedule' }, { status: 500 });
  }
}
