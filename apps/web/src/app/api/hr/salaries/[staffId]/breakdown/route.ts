import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { NigerianPayrollEngine, StatutoryConfigurationRule } from '@/lib/services/payroll-engine-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.view');
    if (!context.canViewSensitive) return NextResponse.json({ error: 'Salary breakdown access is restricted' }, { status: 403 });
    const { staffId } = await params;
    const staff = await prisma.staff.findFirst({
      where: { id: staffId, organizationId: context.organizationId, propertyAccess: { has: context.propertyId }, deletedAt: null },
      include: {
        employeeProfile: true,
        salaryStructure: true,
        employeeLoans: { where: { propertyId: context.propertyId, status: 'ACTIVE' } },
        salaryAdvances: { where: { propertyId: context.propertyId, status: 'APPROVED' } },
      },
    });
    if (!staff?.salaryStructure) return NextResponse.json({ error: 'Salary structure not found' }, { status: 404 });

    const now = new Date();
    const statutory = await prisma.statutoryConfiguration.findFirst({
      where: { organizationId: context.organizationId, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
      orderBy: { effectiveFrom: 'desc' },
    });
    const config: StatutoryConfigurationRule | undefined = statutory ? {
      versionTag: statutory.versionTag,
      craPercentGross: Number(statutory.craPercentGross),
      craBaseAmount: Number(statutory.craBaseAmount),
      craHigherPercent: Number(statutory.craHigherPercent),
      taxBands: Array.isArray(statutory.taxBands) ? (statutory.taxBands as any[]).map((band) => ({ cap: band.cap ?? band.threshold, threshold: band.threshold ?? band.cap, rate: Number(band.rate) })) : undefined,
      pensionEmployeeRate: Number(statutory.pensionEmployeeRate),
      pensionEmployerRate: Number(statutory.pensionEmployerRate),
      nhfRate: Number(statutory.nhfRate),
      nsitfRate: Number(statutory.nsitfRate),
      itfRate: Number(statutory.itfRate),
      minimumWageFloor: Number(statutory.minimumWageFloor),
    } : undefined;
    const calculation = NigerianPayrollEngine.calculateEmployee({
      staffId: staff.id,
      name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
      employeeCode: staff.employeeId || staff.id.slice(0, 8).toUpperCase(),
      department: staff.department || 'General',
      position: staff.position || 'Staff',
      baseSalary: Number(staff.salaryStructure.basicSalary),
      housingAllowance: Number(staff.salaryStructure.housingAllowance || 0),
      transportAllowance: Number(staff.salaryStructure.transportAllowance || 0),
      otherAllowances: Number(staff.salaryStructure.otherAllowances || 0),
      loanRepayment: staff.employeeLoans.reduce((sum, loan) => sum + Number(loan.monthlyDeduction || 0), 0),
      salaryAdvanceRepayment: staff.salaryAdvances.reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
      taxId: staff.employeeProfile?.tin || '',
      rsaPin: staff.salaryStructure.pensionNumber || '',
      bankAccountNumber: staff.salaryStructure.bankAccountNumber || '',
    }, config);
    return NextResponse.json({ calculation, currency: staff.salaryStructure.currency || 'NGN', statutoryVersion: statutory?.versionTag || 'Default payroll rules' });
  } catch (error: any) {
    const message = String(error?.message || 'Failed to calculate salary breakdown');
    return NextResponse.json({ error: message }, { status: /Unauthorized/i.test(message) ? 401 : /Forbidden/i.test(message) ? 403 : 500 });
  }
}
