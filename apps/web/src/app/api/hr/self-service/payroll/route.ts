import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const requestedYear = Number(req.nextUrl.searchParams.get('year')) || new Date().getUTCFullYear();
    const staff = await prisma.staff.findFirst({
      where: { userId: context.userId, organizationId: context.organizationId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!staff) return NextResponse.json({ error: 'Linked employee record not found' }, { status: 404 });

    const payslips = await prisma.payslip.findMany({
      where: { staffId: staff.id, propertyId: context.propertyId, status: { not: 'DRAFT' }, payrollPeriod: { startDate: { gte: new Date(Date.UTC(requestedYear, 0, 1)), lt: new Date(Date.UTC(requestedYear + 1, 0, 1)) } } },
      include: { payrollPeriod: true, components: true, payout: true },
      orderBy: { payrollPeriod: { startDate: 'desc' } },
      take: 36,
    });
    const totals = payslips.reduce((result, payslip) => {
      result.gross += Number(payslip.grossEarnings);
      result.deductions += Number(payslip.totalDeductions);
      result.net += Number(payslip.netPay);
      return result;
    }, { gross: 0, deductions: 0, net: 0 });

    return NextResponse.json({
      yearToDate: totals,
      year: requestedYear,
      payslips: payslips.map((payslip) => ({
        id: payslip.id,
        period: payslip.payrollPeriod.name,
        startDate: payslip.payrollPeriod.startDate,
        endDate: payslip.payrollPeriod.endDate,
        paymentDate: payslip.payrollPeriod.paymentDate,
        gross: Number(payslip.grossEarnings),
        deductions: Number(payslip.totalDeductions),
        net: Number(payslip.netPay),
        status: payslip.status,
        paymentStatus: payslip.payout?.status || payslip.payrollPeriod.paymentStatus || 'UNPAID',
        components: payslip.components.map((component) => ({ name: component.name, type: component.type, amount: Number(component.amount) })),
      })),
    });
  } catch (error: any) {
    const message = error?.message || 'Unable to load payroll history';
    return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500 });
  }
}
