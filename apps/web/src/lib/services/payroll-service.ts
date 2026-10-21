import { prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { randomUUID } from 'crypto';
import { NigerianPayrollEngine, StatutoryConfigurationRule } from './payroll-engine-service';

export class PayrollService {
  /**
   * List salary structures for a property.
   * Staff is org-scoped but we filter by propertyAccess array.
   */
  static async listStructures(ctx: TenantContext, propertyId: string) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    return prisma.salaryStructure.findMany({
      where: { propertyId },
      include: { staff: true },
    });
  }

  /**
   * Upsert a salary structure for a staff member.
   * Required schema fields: organizationId, propertyId, staffId, basicSalary, effectiveFrom, createdBy
   */
  static async updateStructure(
    ctx: TenantContext,
    staffId: string,
    input: {
      propertyId: string;
      basicSalary: number;
      housingAllowance?: number;
      transportAllowance?: number;
      otherAllowances?: number;
      bankName?: string;
      bankAccountNumber?: string;
      bankSortCode?: string;
      pensionFundAdmin?: string;
      pensionNumber?: string;
      effectiveFrom: Date;
    }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');

    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        organizationId: ctx.organizationId,
        propertyAccess: { has: input.propertyId },
        isActive: true,
        deletedAt: null,
      },
    });
    if (!staff) throw new Error('Staff not found');

    const existing = await prisma.salaryStructure.findUnique({ where: { staffId } });
    if (existing && existing.propertyId !== input.propertyId) {
      throw new Error('Salary structure belongs to a different property');
    }

    return prisma.salaryStructure.upsert({
      where: { staffId },
      update: {
        organizationId: ctx.organizationId,
        propertyId: input.propertyId,
        basicSalary: input.basicSalary,
        housingAllowance: input.housingAllowance ?? 0,
        transportAllowance: input.transportAllowance ?? 0,
        otherAllowances: input.otherAllowances ?? 0,
        bankName: input.bankName,
        bankAccountNumber: input.bankAccountNumber,
        bankSortCode: input.bankSortCode,
        pensionFundAdmin: input.pensionFundAdmin,
        pensionNumber: input.pensionNumber,
        effectiveFrom: input.effectiveFrom,
      },
      create: {
        organizationId: ctx.organizationId,
        propertyId: input.propertyId,
        staffId,
        basicSalary: input.basicSalary,
        housingAllowance: input.housingAllowance ?? 0,
        transportAllowance: input.transportAllowance ?? 0,
        otherAllowances: input.otherAllowances ?? 0,
        bankName: input.bankName,
        bankAccountNumber: input.bankAccountNumber,
        bankSortCode: input.bankSortCode,
        pensionFundAdmin: input.pensionFundAdmin,
        pensionNumber: input.pensionNumber,
        effectiveFrom: input.effectiveFrom,
        createdBy: ctx.userId,
      },
    });
  }

  static async listPeriods(ctx: TenantContext, propertyId: string) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    return prisma.payrollPeriod.findMany({
      where: { organizationId: ctx.organizationId, propertyId },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Create a new payroll period.
   * Required: organizationId, propertyId, name, startDate, endDate, createdBy
   */
  static async createPeriod(
    ctx: TenantContext,
    input: { propertyId: string; name: string; startDate: Date; endDate: Date }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');
    if (!input.name.trim() || Number.isNaN(input.startDate.getTime()) || Number.isNaN(input.endDate.getTime()) || input.startDate > input.endDate) {
      throw new Error('Invalid payroll period');
    }

    const overlap = await prisma.payrollPeriod.findFirst({
      where: {
        organizationId: ctx.organizationId,
        propertyId: input.propertyId,
        OR: [{ startDate: { lte: input.endDate }, endDate: { gte: input.startDate } }],
      },
    });
    if (overlap) throw new Error('Payroll period overlaps with an existing period');

    return prisma.$transaction(async (tx) => {
      const period = await tx.payrollPeriod.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          createdBy: ctx.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          userId: ctx.userId,
          action: 'PAYROLL_PERIOD_CREATED',
          resource: 'PayrollPeriod',
          resourceId: period.id,
          requestId: randomUUID(),
          newValue: { name: period.name },
        },
      });

      return period;
    });
  }

  /**
   * Generate payslips for all active staff in a property for a period.
   */
  static async processPayroll(ctx: TenantContext, periodId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error('Period not found');
    if (!ctx.propertyIds.includes(period.propertyId)) throw new Error('Unauthorized');
    if (period.status !== 'DRAFT') throw new Error(`Cannot process payroll in status ${period.status}`);

    const statutory = await prisma.statutoryConfiguration.findFirst({
      where: {
        organizationId: ctx.organizationId,
        effectiveFrom: { lte: period.startDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!statutory) throw new Error('No effective statutory configuration exists for this payroll period');
    const statutoryRule: StatutoryConfigurationRule = {
      taxRegime: statutory.taxRegime,
      versionTag: statutory.versionTag,
      craPercentGross: Number(statutory.craPercentGross),
      craBaseAmount: Number(statutory.craBaseAmount),
      craHigherPercent: Number(statutory.craHigherPercent),
      taxBands: Array.isArray(statutory.taxBands)
        ? (statutory.taxBands as any[]).map((band) => ({
          cap: band.cap !== undefined && band.cap !== null ? Number(band.cap) : (band.threshold !== undefined && band.threshold !== null ? Number(band.threshold) : null),
          threshold: band.threshold !== undefined && band.threshold !== null ? Number(band.threshold) : (band.cap !== undefined && band.cap !== null ? Number(band.cap) : null),
          rate: Number(band.rate),
        }))
        : undefined,
      pensionEmployeeRate: Number(statutory.pensionEmployeeRate),
      pensionEmployerRate: Number(statutory.pensionEmployerRate),
      pensionEnabled: statutory.pensionEnabled,
      pensionExemptionReason: statutory.pensionExemptionReason,
      nhfRate: Number(statutory.nhfRate),
      nhfEnabled: statutory.nhfEnabled,
      nhfExemptionReason: statutory.nhfExemptionReason,
      nsitfRate: Number(statutory.nsitfRate),
      itfRate: Number(statutory.itfRate),
      minimumWageFloor: Number(statutory.minimumWageFloor),
    };

    // Get salary structures for this property
    const structures = await prisma.salaryStructure.findMany({
      where: {
        organizationId: ctx.organizationId,
        propertyId: period.propertyId,
        isActive: true,
        staff: { is: { organizationId: ctx.organizationId, propertyAccess: { has: period.propertyId }, isActive: true, deletedAt: null } },
      },
      include: {
        staff: {
          include: {
            employeeProfile: true,
            employeeLoans: { where: { status: 'ACTIVE', propertyId: period.propertyId } },
            salaryAdvances: { where: { status: 'APPROVED', propertyId: period.propertyId } },
          },
        },
      },
    });

    const referralCommissions = await prisma.referralCommission.findMany({
      where: {
        organizationId: ctx.organizationId,
        propertyId: period.propertyId,
        status: 'APPROVED',
        payslipId: null,
        earnedAt: { lte: period.endDate },
        partner: { isStaffReferrer: true, staff: { is: { organizationId: ctx.organizationId, propertyAccess: { has: period.propertyId }, isActive: true, deletedAt: null } } },
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

    return prisma.$transaction(async (tx) => {
      await tx.payslip.deleteMany({ where: { payrollPeriodId: periodId } });

      let periodGross = 0;
      let periodNet = 0;
      let periodPAYE = 0;
      let periodDeductions = 0;
      let periodEmployerPension = 0;

      for (const struct of structures) {
        const basic = Number(struct.basicSalary);
        const housing = Number(struct.housingAllowance || 0);
        const transport = Number(struct.transportAllowance || 0);
        const other = Number(struct.otherAllowances || 0);
        const referralCommission = referralByStaff.get(struct.staffId)?.total || 0;
        const gross = basic + housing + transport + other + referralCommission;

        const profile = struct.staff.employeeProfile;
        const loanRepayment = struct.staff.employeeLoans.reduce((sum, loan) => sum + Number(loan.monthlyDeduction || 0), 0);
        const salaryAdvanceRepayment = struct.staff.salaryAdvances.reduce((sum, advance) => sum + Number(advance.amount || 0), 0);
        const calculated = NigerianPayrollEngine.calculateEmployee({
          staffId: struct.staffId,
          name: `${struct.staff.firstName} ${struct.staff.lastName}`.trim() || struct.staff.email,
          employeeCode: struct.staff.employeeId || `EMP-${struct.staffId.slice(0, 8).toUpperCase()}`,
          department: struct.staff.department || 'General',
          position: struct.staff.position || 'Staff',
          bankName: struct.bankName || '',
          bankAccountNumber: struct.bankAccountNumber || '',
          bankSortCode: struct.bankSortCode || '',
          bankAccountName: struct.bankAccountName || `${struct.staff.firstName} ${struct.staff.lastName}`,
          bvn: profile?.bvn || '',
          nin: profile?.nin || '',
          taxId: profile?.tin || '',
          rsaPin: struct.pensionNumber || '',
          pfaName: struct.pensionFundAdmin || '',
          baseSalary: basic,
          housingAllowance: housing,
          transportAllowance: transport,
          otherAllowances: other,
          bonuses: referralCommission,
          loanRepayment,
          salaryAdvanceRepayment,
          pensionApplicable: !profile?.pensionExempt,
          nhfApplicable: !profile?.nhfExempt,
          nhisMonthlyContribution: Number(profile?.nhisMonthlyContribution || 0),
          annualRentPaid: Number(profile?.annualRentPaid || 0),
          annualLifeAssurance: Number(profile?.annualLifeAssurance || 0),
          annualMortgageInterest: Number(profile?.annualMortgageInterest || 0),
        }, statutoryRule);
        const { pensionEmployee: pension, pensionEmployer, nhfDeduction, nsitfEmployer: nsitf, payeTax: paye, itfEmployer: itf } = calculated;
        const totalDed = calculated.totalDeductions;
        const net = calculated.netPay;

        periodGross += gross;
        periodNet += net;
        periodPAYE += paye;
        periodDeductions += totalDed;
        periodEmployerPension += pensionEmployer;

        const payslip = await tx.payslip.create({
          data: {
            propertyId: period.propertyId,
            payrollPeriodId: periodId,
            staffId: struct.staffId,
            basicSalary: basic,
            housingAllowance: housing,
            transportAllowance: transport,
            otherAllowances: other,
            grossEarnings: gross,
            referralCommission,
            payeTax: paye,
            pensionEmployee: pension,
            pensionEmployer,
            nhf: nhfDeduction,
            nsitf,
            loanDeductions: calculated.loanRepayment + calculated.salaryAdvance,
            totalDeductions: totalDed,
            netPay: net,
            bankName: struct.bankName,
            accountNumber: struct.bankAccountNumber,
          },
        });

        const components = [
          { payslipId: payslip.id, type: 'EARNING', name: 'Basic Salary', amount: basic },
          ...(housing > 0 ? [{ payslipId: payslip.id, type: 'EARNING', name: 'Housing Allowance', amount: housing }] : []),
          ...(transport > 0 ? [{ payslipId: payslip.id, type: 'EARNING', name: 'Transport Allowance', amount: transport }] : []),
          ...(other > 0 ? [{ payslipId: payslip.id, type: 'EARNING', name: 'Other Allowances', amount: other }] : []),
          ...(referralCommission > 0 ? [{ payslipId: payslip.id, type: 'EARNING', name: 'Referral Commission', amount: referralCommission }] : []),
          { payslipId: payslip.id, type: 'STATUTORY', name: 'PAYE Tax', amount: paye },
          { payslipId: payslip.id, type: 'STATUTORY', name: 'NHF', amount: nhfDeduction },
          { payslipId: payslip.id, type: 'EMPLOYER_CONTRIBUTION', name: 'NSITF (Employer)', amount: nsitf },
          { payslipId: payslip.id, type: 'EMPLOYER_CONTRIBUTION', name: 'ITF (Employer)', amount: itf },
          { payslipId: payslip.id, type: 'DEDUCTION', name: 'Loan Recovery', amount: calculated.loanRepayment },
          { payslipId: payslip.id, type: 'DEDUCTION', name: 'Salary Advance Recovery', amount: calculated.salaryAdvance },
        ];

        await tx.payslipComponent.createMany({ data: components });
        const commissionIds = referralByStaff.get(struct.staffId)?.ids || [];
        if (commissionIds.length) {
          const claimed = await tx.referralCommission.updateMany({ where: { id: { in: commissionIds }, status: 'APPROVED', payslipId: null }, data: { payslipId: payslip.id, payslipInjectedAt: new Date() } });
          if (claimed.count !== commissionIds.length) throw new Error('Referral commission claim conflict; payroll was not generated');
        }
      }

      const updatedPeriod = await tx.payrollPeriod.update({
        where: { id: periodId },
        data: {
          totalGross: periodGross,
          totalNet: periodNet,
          totalPAYE: periodPAYE,
          totalDeductions: periodDeductions,
          totalEmployerPension: periodEmployerPension,
          status: 'PROCESSING',
          processedBy: ctx.userId,
          processedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: period.propertyId,
          userId: ctx.userId,
          action: 'PAYROLL_PROCESSED',
          resource: 'PayrollPeriod',
          resourceId: period.id,
          requestId: randomUUID(),
          newValue: { totalGross: periodGross, totalNet: periodNet, staffCount: structures.length },
        },
      });

      return updatedPeriod;
    });
  }

  static async approvePeriod(ctx: TenantContext, periodId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error('Period not found');
    if (!ctx.propertyIds.includes(period.propertyId)) throw new Error('Unauthorized');

    if (ctx.role !== 'SUPER_ADMIN' && ctx.role !== 'GENERAL_MANAGER') {
      throw new Error('Only General Manager or Super Admin can approve payroll');
    }
    if (period.status !== 'PROCESSING') throw new Error(`Cannot approve payroll with status ${period.status}`);

    return prisma.$transaction(async (tx) => {
      const approved = await tx.payrollPeriod.update({
        where: { id: periodId },
        data: { status: 'APPROVED', approvedBy: ctx.userId, approvedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: period.propertyId,
          userId: ctx.userId,
          action: 'PAYROLL_APPROVED',
          resource: 'PayrollPeriod',
          resourceId: period.id,
          requestId: randomUUID(),
        },
      });

      return approved;
    });
  }

  static async payPeriod(ctx: TenantContext, periodId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error('Period not found');
    if (!ctx.propertyIds.includes(period.propertyId)) throw new Error('Unauthorized');
    if (!['SUPER_ADMIN', 'GENERAL_MANAGER', 'FINANCE_MANAGER'].includes(ctx.role)) {
      throw new Error('Only Finance Manager, General Manager, or Super Admin can release payroll');
    }
    if (period.status !== 'APPROVED') throw new Error(`Cannot pay payroll with status ${period.status}`);

    return prisma.$transaction(async (tx) => {
      const paid = await tx.payrollPeriod.update({
        where: { id: periodId },
        data: { status: 'PAID' },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: period.propertyId,
          userId: ctx.userId,
          action: 'PAYROLL_PAID',
          resource: 'PayrollPeriod',
          resourceId: period.id,
          requestId: randomUUID(),
        },
      });

      return paid;
    });
  }
}
