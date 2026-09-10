import { prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { randomUUID } from 'crypto';

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

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new Error('Staff not found');

    return prisma.salaryStructure.upsert({
      where: { staffId },
      update: {
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
      where: { propertyId },
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

    const overlap = await prisma.payrollPeriod.findFirst({
      where: {
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
   * Nigerian Payroll Calculation.
   * Returns monthly amounts.
   */
  static calculateNigerianTaxes(grossIncome: number, basicSalary: number) {
    const pension = grossIncome * 0.08;          // 8% employee pension
    const pensionEmployer = grossIncome * 0.10;  // 10% employer pension
    const nhf = basicSalary * 0.025;             // 2.5% NHF on basic
    const nsitf = grossIncome * 0.01;            // 1% NSITF

    const statutoryDeductions = pension + nhf;
    const cra = Math.max(200000 / 12, grossIncome * 0.01) + grossIncome * 0.2;
    let taxableIncome = Math.max(0, grossIncome - statutoryDeductions - cra);

    // PAYE bands (monthly equivalent of annual bands)
    let paye = 0;
    let remaining = taxableIncome;
    const bands = [
      { limit: 300000 / 12, rate: 0.07 },
      { limit: 300000 / 12, rate: 0.11 },
      { limit: 500000 / 12, rate: 0.15 },
      { limit: 500000 / 12, rate: 0.19 },
      { limit: 1600000 / 12, rate: 0.21 },
      { limit: Infinity, rate: 0.24 },
    ];
    for (const band of bands) {
      if (remaining <= 0) break;
      const taxable = Math.min(remaining, band.limit);
      paye += taxable * band.rate;
      remaining -= taxable;
    }

    return { pension, pensionEmployer, nhf, nsitf, paye };
  }

  /**
   * Generate payslips for all active staff in a property for a period.
   */
  static async processPayroll(ctx: TenantContext, periodId: string) {
    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error('Period not found');
    if (!ctx.propertyIds.includes(period.propertyId)) throw new Error('Unauthorized');
    if (period.status !== 'DRAFT') throw new Error(`Cannot process payroll in status ${period.status}`);

    // Get salary structures for this property
    const structures = await prisma.salaryStructure.findMany({
      where: { propertyId: period.propertyId, isActive: true },
      include: { staff: true },
    });

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
        const gross = basic + housing + transport + other;

        const { pension, pensionEmployer, nhf, nsitf, paye } = this.calculateNigerianTaxes(gross, basic);
        const totalDed = pension + nhf + nsitf + paye;
        const net = gross - totalDed;

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
            payeTax: paye,
            pensionEmployee: pension,
            pensionEmployer,
            nhf,
            nsitf,
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
          { payslipId: payslip.id, type: 'STATUTORY', name: 'PAYE Tax', amount: paye },
          { payslipId: payslip.id, type: 'STATUTORY', name: 'Pension (Employee 8%)', amount: pension },
          { payslipId: payslip.id, type: 'STATUTORY', name: 'NHF (2.5%)', amount: nhf },
          { payslipId: payslip.id, type: 'STATUTORY', name: 'NSITF (1%)', amount: nsitf },
        ];

        await tx.payslipComponent.createMany({ data: components });
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
