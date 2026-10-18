import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { NigerianPayrollEngine, EmployeePayrollInput, StatutoryConfigurationRule } from '@/lib/services/payroll-engine-service';
import { PiiMaskingService } from '@/lib/services/pii-masking-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.view');
    if (!context.propertyId) {
      return NextResponse.json({ error: 'Property context is required' }, { status: 400 });
    }

    const periods = await prisma.payrollPeriod.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId: context.propertyId,
      },
      include: {
        payslips: {
          select: {
            id: true,
            grossEarnings: true,
            netPay: true,
            totalDeductions: true,
            pensionEmployer: true,
            nsitf: true,
            components: true,
          },
        },
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startDate: 'desc' },
      take: 24,
    });

    const formattedPeriods = periods.map((p) => {
      const totalGross = p.payslips.reduce((sum, ps) => sum + Number(ps.grossEarnings || 0), 0);
      const totalNet = p.payslips.reduce((sum, ps) => sum + Number(ps.netPay || 0), 0);
      const totalDeductions = p.payslips.reduce((sum, ps) => sum + Number(ps.totalDeductions || 0), 0);

      const employerCost = p.payslips.reduce((sum, ps) => {
        const levyCost = ps.components
          .filter((c: any) => c.name.includes('ITF'))
          .reduce((componentSum: number, c: any) => componentSum + Number(c.amount || 0), 0);
        return sum + Number(ps.grossEarnings || 0) + Number(ps.pensionEmployer || 0) + Number(ps.nsitf || 0) + levyCost;
      }, 0);

      return {
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        status: p.status,
        propertyName: p.property.name,
        employeeCount: p.payslips.length,
        totalGross: context.canViewSensitive ? totalGross : PiiMaskingService.maskCompensation(totalGross, false),
        totalNet: context.canViewSensitive ? totalNet : PiiMaskingService.maskCompensation(totalNet, false),
        totalDeductions: context.canViewSensitive ? totalDeductions : PiiMaskingService.maskCompensation(totalDeductions, false),
        totalEmployerCost: context.canViewSensitive ? employerCost : PiiMaskingService.maskCompensation(employerCost, false),
        journalEntryId: p.journalEntryId,
        paymentStatus: p.paymentStatus,
        paymentBatchRef: p.paymentBatchRef,
      };
    });

    return NextResponse.json({ periods: formattedPeriods });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to list payroll periods:', error);
    return NextResponse.json({ error: 'Failed to retrieve payroll runs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.payroll.prepare');
    if (!context.propertyId) {
      return NextResponse.json({ error: 'Property context is required' }, { status: 400 });
    }

    const body = await req.json();
    const { month, year } = body;

    const now = new Date();
    const selectedMonth = parseInt(month || String(now.getMonth() + 1), 10);
    const selectedYear = parseInt(year || String(now.getFullYear()), 10);

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0);
    const monthName = startDate.toLocaleString('en-US', { month: 'long' });
    const periodName = `${monthName} ${selectedYear} Payroll`;

    // Check if payroll period already exists for this property and month
    const existing = await prisma.payrollPeriod.findFirst({
      where: {
        organizationId: context.organizationId,
        propertyId: context.propertyId,
        startDate,
      },
    });

    if (existing && existing.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: `A payroll batch for ${monthName} ${selectedYear} already exists (Status: ${existing.status}).` },
        { status: 409 }
      );
    }

    // 1. Fetch effective Statutory Configuration for the period date
    const statutoryConfigRecord = await prisma.statutoryConfiguration.findFirst({
      where: {
        organizationId: context.organizationId,
        effectiveFrom: { lte: startDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: startDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!statutoryConfigRecord) {
      return NextResponse.json(
        { error: 'Payroll run blocked: No effective statutory configuration exists for this payroll period. Configure and approve the Nigerian statutory rules first.' },
        { status: 422 },
      );
    }

    const statutoryRule: StatutoryConfigurationRule = {
          versionTag: statutoryConfigRecord.versionTag,
          craPercentGross: Number(statutoryConfigRecord.craPercentGross),
          craBaseAmount: Number(statutoryConfigRecord.craBaseAmount),
          craHigherPercent: Number(statutoryConfigRecord.craHigherPercent),
          taxBands: Array.isArray(statutoryConfigRecord.taxBands)
            ? (statutoryConfigRecord.taxBands as any[]).map((b) => ({
                cap: b.cap !== undefined && b.cap !== null ? Number(b.cap) : (b.threshold !== undefined && b.threshold !== null ? Number(b.threshold) : null),
                threshold: b.threshold !== undefined && b.threshold !== null ? Number(b.threshold) : (b.cap !== undefined && b.cap !== null ? Number(b.cap) : null),
                rate: Number(b.rate),
              }))
            : undefined,
          pensionEmployeeRate: Number(statutoryConfigRecord.pensionEmployeeRate),
          pensionEmployerRate: Number(statutoryConfigRecord.pensionEmployerRate),
          nhfRate: Number(statutoryConfigRecord.nhfRate),
          nsitfRate: Number(statutoryConfigRecord.nsitfRate),
          itfRate: Number(statutoryConfigRecord.itfRate),
          minimumWageFloor: Number(statutoryConfigRecord.minimumWageFloor),
        };

    // 2. Fetch all active staff strictly for this property & organization
    const staffList = await prisma.staff.findMany({
      where: {
        organizationId: context.organizationId,
        propertyAccess: { has: context.propertyId },
        ...(context.role === 'DEPARTMENT_HEAD' && context.department
          ? { department: context.department }
          : {}),
        isActive: true,
        deletedAt: null,
      },
      include: {
        employeeProfile: true,
        salaryStructure: true,
        salaryStructureVersions: {
          where: {
            propertyId: context.propertyId,
            effectiveFrom: { lte: endDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        },
        attendanceRecords: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
        employeeLoans: {
          where: { status: 'ACTIVE', propertyId: context.propertyId },
        },
        salaryAdvances: {
          where: { status: 'APPROVED', propertyId: context.propertyId },
        },
      },
    });

    if (staffList.length === 0) {
      return NextResponse.json(
        { error: 'No active employees found in this property to include in payroll run.' },
        { status: 400 }
      );
    }

    const approvedPenaltyAssessments = await prisma.attendancePenaltyAssessment.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId: context.propertyId,
        status: 'APPROVED',
        payrollPeriodId: null,
        eventDate: { gte: startDate, lte: endDate },
      },
      select: { id: true, staffId: true, assessedAmount: true },
    });
    const penaltiesByStaff = new Map<string, { amount: number; ids: string[] }>();
    for (const assessment of approvedPenaltyAssessments) {
      const current = penaltiesByStaff.get(assessment.staffId) || { amount: 0, ids: [] };
      current.amount += Number(assessment.assessedAmount);
      current.ids.push(assessment.id);
      penaltiesByStaff.set(assessment.staffId, current);
    }

    // 3. ZERO SILENT FALLBACKS: Validate that all employees have a real salary structure
    const unconfiguredStaff = staffList.filter(
      (s) => {
        const effectiveSalary = s.salaryStructureVersions?.find((v: any) =>
          new Date(v.effectiveFrom) <= endDate && (!v.effectiveTo || new Date(v.effectiveTo) >= startDate)
        ) || s.salaryStructure;
        return !effectiveSalary || Number(effectiveSalary.basicSalary) <= 0;
      }
    );

    if (unconfiguredStaff.length > 0) {
      return NextResponse.json(
        {
          error: 'Payroll run blocked: One or more employees lack an assigned salary structure. Assign compensation packages in the employee master before preparing payroll.',
          unconfiguredEmployees: unconfiguredStaff.map((s) => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`.trim(),
            employeeCode: s.employeeId || s.id.slice(0, 8),
            department: s.department,
          })),
        },
        { status: 422 }
      );
    }

    // Staff referral commissions are eligible only when already approved and
    // earned by the payroll period end date. They are claimed atomically when
    // the payslip is created so a retry cannot inject them twice.
    const referralCommissions = await prisma.referralCommission.findMany({
      where: {
        organizationId: context.organizationId,
        propertyId: context.propertyId,
        status: 'APPROVED',
        payslipId: null,
        earnedAt: { lte: endDate },
        partner: { isStaffReferrer: true, staff: { is: { organizationId: context.organizationId, propertyAccess: { has: context.propertyId }, isActive: true, deletedAt: null } } },
      },
      select: { id: true, amount: true, partner: { select: { staffId: true } } },
    });
    const referralByStaff = new Map<string, { total: number; ids: string[] }>();
    for (const commission of referralCommissions) {
      if (!commission.partner.staffId) continue;
      const current = referralByStaff.get(commission.partner.staffId) || { total: 0, ids: [] };
      current.total += Number(commission.amount);
      current.ids.push(commission.id);
      referralByStaff.set(commission.partner.staffId, current);
    }

    // 4. Prepare calculation inputs
    const engineInputs: EmployeePayrollInput[] = staffList.map((s) => {
      const salary = s.salaryStructureVersions?.find((v: any) =>
        new Date(v.effectiveFrom) <= endDate && (!v.effectiveTo || new Date(v.effectiveTo) >= startDate)
      ) || s.salaryStructure;
      const basicSalary = Number(salary!.basicSalary);
      const housingAllowance = Number(salary!.housingAllowance || 0);
      const transportAllowance = Number(salary!.transportAllowance || 0);
      const otherAllowances = Number(salary!.otherAllowances || 0);

      // Overtime sum
      const overtimeMinutes = s.attendanceRecords.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0);
      const overtimeHours = Math.round((overtimeMinutes / 60) * 10) / 10;
      const hourlyRate = (basicSalary / 160) * 1.5;

      // Active Loan installments & advances
      const loanRepayment = s.employeeLoans.reduce((sum, l) => sum + Number(l.monthlyDeduction || 0), 0);
      const salaryAdvanceRepayment = s.salaryAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const penaltyDeduction = penaltiesByStaff.get(s.id)?.amount || 0;
      const referralCommission = referralByStaff.get(s.id)?.total || 0;

      return {
        staffId: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
        employeeCode: s.employeeId || `EMP-${s.id.slice(0, 4).toUpperCase()}`,
        department: s.department || 'General',
        position: s.position || 'Staff',
        bankName: salary?.bankName || '',
        bankAccountNumber: salary?.bankAccountNumber || '',
        bankSortCode: salary?.bankSortCode || '',
        bankAccountName: `${s.firstName} ${s.lastName}`,
        bvn: s.employeeProfile?.bvn || '',
        nin: s.employeeProfile?.nin || '',
        taxId: s.employeeProfile?.tin || '',
        rsaPin: salary?.pensionNumber || '',
        pfaName: salary?.pensionFundAdmin || '',
        baseSalary: basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        overtimeHours,
        overtimeRate: hourlyRate,
        loanRepayment,
        salaryAdvanceRepayment,
        penaltyDeduction,
        bonuses: referralCommission,
      };
    });

    // 5. Execute deterministic statutory calculation
    const calculatedBatch = NigerianPayrollEngine.calculateBatch(
      periodName,
      engineInputs,
      statutoryRule
    );

    // 6. Save into database atomically
    const savedPeriod = await prisma.$transaction(async (tx: any) => {
      const period = await tx.payrollPeriod.create({
        data: {
          organizationId: context.organizationId,
          propertyId: context.propertyId,
          name: periodName,
          startDate,
          endDate,
          status: 'DRAFT',
          totalGross: calculatedBatch.totalGrossPay,
          totalNet: calculatedBatch.totalNetPay,
          totalDeductions: calculatedBatch.totalDeductions,
          totalEmployerPension: calculatedBatch.totalEmployerPension,
          totalPAYE: calculatedBatch.totalPayeTax,
          paymentStatus: 'UNPAID',
          snapshot: {
            ...JSON.parse(JSON.stringify(calculatedBatch)),
            statutoryRuleApplied: statutoryRule,
            statutoryConfigId: statutoryConfigRecord.id,
            statutoryConfigVersion: statutoryConfigRecord.versionTag,
          },
          approvalTrail: [
            {
              stage: 'PREPARED',
              userId: context.userId,
              timestamp: new Date().toISOString(),
              summary: {
                totalEmployees: calculatedBatch.totalEmployees,
                grossPay: calculatedBatch.totalGrossPay,
                netPay: calculatedBatch.totalNetPay,
              },
            },
          ],
          createdBy: context.userId,
        },
      });

      // Save individual payslips
      for (const p of calculatedBatch.payslips) {
        const payslip = await tx.payslip.create({
          data: {
            payrollPeriodId: period.id,
            staffId: p.staffId,
            propertyId: context.propertyId,
            basicSalary: p.basicSalary,
            housingAllowance: p.housingAllowance,
            transportAllowance: p.transportAllowance,
            otherAllowances: p.otherAllowances,
            overtime: p.overtimePay,
            grossEarnings: p.grossPay,
            payeTax: p.payeTax,
            pensionEmployee: p.pensionEmployee,
            pensionEmployer: p.pensionEmployer,
            nhf: p.nhfDeduction,
            loanDeductions: p.loanRepayment + p.salaryAdvance,
            otherDeductions: p.penaltyDeduction,
            totalDeductions: p.totalDeductions,
            netPay: p.netPay,
            bankName: p.bankName,
            accountNumber: p.bankAccountNumber,
            bankSortCode: p.bankSortCode,
            bvn: p.bvn || null,
            tin: p.taxId || null,
            rsaPin: p.rsaPin || null,
            pfaName: p.pfaName || null,
            status: 'DRAFT',
            referralCommission: p.bonuses,
          },
        });

        // Save detailed components
        const components = [
          { name: 'Basic Salary', type: 'EARNING', amount: p.basicSalary },
          { name: 'Housing Allowance', type: 'EARNING', amount: p.housingAllowance },
          { name: 'Transport Allowance', type: 'EARNING', amount: p.transportAllowance },
          { name: 'Overtime Pay', type: 'EARNING', amount: p.overtimePay },
          ...(p.bonuses > 0 ? [{ name: 'Referral Commission', type: 'EARNING', amount: p.bonuses }] : []),
          { name: 'PAYE Tax (PITA)', type: 'DEDUCTION', amount: p.payeTax },
          { name: 'Pension Employee (8%)', type: 'DEDUCTION', amount: p.pensionEmployee },
          { name: 'Pension Employer (10%)', type: 'EMPLOYER_CONTRIBUTION', amount: p.pensionEmployer },
          { name: 'NHF (2.5%)', type: 'DEDUCTION', amount: p.nhfDeduction },
          { name: 'NSITF (1%)', type: 'EMPLOYER_CONTRIBUTION', amount: p.nsitfEmployer },
          { name: 'ITF (1%)', type: 'EMPLOYER_CONTRIBUTION', amount: p.itfEmployer },
          { name: 'Loan Recovery', type: 'DEDUCTION', amount: p.loanRepayment },
          { name: 'Salary Advance Recovery', type: 'DEDUCTION', amount: p.salaryAdvance },
          { name: 'Approved Attendance Penalties', type: 'DEDUCTION', amount: p.penaltyDeduction },
        ].filter((c) => c.amount > 0);

        await tx.payslipComponent.createMany({
          data: components.map((c) => ({
            payslipId: payslip.id,
            name: c.name,
            type: c.type,
            amount: c.amount,
          })),
        });

        const commissionIds = referralByStaff.get(p.staffId)?.ids || [];
        if (commissionIds.length) {
          const claimed = await tx.referralCommission.updateMany({
            where: { id: { in: commissionIds }, status: 'APPROVED', payslipId: null },
            data: { payslipId: payslip.id, payslipInjectedAt: new Date() },
          });
          if (claimed.count !== commissionIds.length) throw new Error('Referral commission claim conflict; payroll was not generated');
        }
        const penaltyIds = penaltiesByStaff.get(p.staffId)?.ids || [];
        if (penaltyIds.length) {
          const claimed = await tx.attendancePenaltyAssessment.updateMany({
            where: { id: { in: penaltyIds }, status: 'APPROVED', payrollPeriodId: null },
            data: { status: 'APPLIED', payrollPeriodId: period.id, appliedAt: new Date() },
          });
          if (claimed.count !== penaltyIds.length) throw new Error('Attendance penalty claim conflict; payroll was not generated');
        }
      }

      return period;
    });

    return NextResponse.json(
      {
        success: true,
        periodId: savedPeriod.id,
        summary: calculatedBatch,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to run payroll batch:', error);
    return NextResponse.json({ error: 'Failed to process payroll batch calculation' }, { status: 500 });
  }
}
