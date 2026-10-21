/**
 * Deterministic Nigerian Statutory Payroll Engine for LodgeCore
 *
 * Implements:
 * 1. PITA (Personal Income Tax Act) with Consolidated Relief Allowance (CRA):
 *    - CRA = max(200,000, 1% of Gross) + 20% of Gross
 *    - Deductible non-taxable allowances: Employee Pension (8%), NHF (2.5% of basic)
 *    - Taxable Income = Gross Income - (CRA + Pension + NHF)
 *    - Graduated Tax Brackets:
 *        First 300,000 @ 7%
 *        Next  300,000 @ 11%
 *        Next  500,000 @ 15%
 *        Next  500,000 @ 19%
 *        Next  1,600,000 @ 21%
 *        Above 3,200,000 @ 24%
 *    - Minimum Tax Rule: 1% of Gross if calculated PAYE < 1% of Gross.
 *
 * 2. Pension Reform Act 2014:
 *    - Base Emolument: Basic + Housing + Transport
 *    - Employee Pension: 8% (Deduction)
 *    - Employer Pension: 10% (Employer Cost)
 *
 * 3. National Housing Fund (NHF):
 *    - 2.5% of Basic Salary
 *
 * 4. Employees Compensation Act (NSITF):
 *    - 1% of Total Payroll (Employer Cost)
 *
 * 5. Industrial Training Fund (ITF):
 *    - 1% of Total Payroll (Employer Cost)
 */

export interface TaxBandRule {
  cap?: number | null;
  threshold?: number | null;
  rate: number;
}

export interface StatutoryConfigurationRule {
  versionTag?: string;
  taxRegime?: 'PITA_2011' | 'NTA_2026' | string;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string | null;
  craPercentGross?: number; // default 0.20
  craBaseAmount?: number; // default 200,000
  craHigherPercent?: number; // default 0.01
  taxBands?: Array<TaxBandRule>;
  pensionEmployeeRate?: number; // default 0.08
  pensionEmployerRate?: number; // default 0.10
  pensionEnabled?: boolean;
  pensionExemptionReason?: string | null;
  nhfRate?: number; // default 0.025
  nhfEnabled?: boolean;
  nhfExemptionReason?: string | null;
  nsitfRate?: number; // default 0.01
  itfRate?: number; // default 0.01
  minimumTaxRate?: number; // default 0.01
  minimumWageFloor?: number; // default 70,000 monthly
}

export interface EmployeePayrollInput {
  staffId: string;
  name: string;
  employeeCode: string;
  department: string;
  position: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  bankAccountName?: string;
  bvn?: string;
  nin?: string;
  taxId?: string;
  rsaPin?: string;
  pfaName?: string;
  baseSalary: number; // Monthly Basic
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  overtimeHours?: number;
  overtimeRate?: number; // per hour
  bonuses?: number;
  loanRepayment?: number;
  salaryAdvanceRepayment?: number;
  penaltyDeduction?: number;
  hasNhf?: boolean;
  pensionApplicable?: boolean;
  nhfApplicable?: boolean;
  nhisMonthlyContribution?: number;
  annualRentPaid?: number;
  annualLifeAssurance?: number;
  annualMortgageInterest?: number;
}

export interface CalculatedPayslip {
  staffId: string;
  name: string;
  employeeCode: string;
  department: string;
  position: string;
  bankName: string;
  bankAccountNumber: string;
  bankSortCode: string;
  bankAccountName: string;
  bvn: string;
  taxId: string;
  rsaPin: string;
  pfaName: string;

  // Earnings
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  overtimePay: number;
  bonuses: number;
  grossPay: number;

  // Statutory Deductions (Employee)
  cra: number; // Annual CRA / 12
  taxableIncome: number;
  payeTax: number;
  pensionEmployee: number; // 8%
  nhfDeduction: number; // 2.5%
  nhisDeduction: number;
  eligibleReliefs: number;

  // Non-statutory Deductions
  loanRepayment: number;
  salaryAdvance: number;
  penaltyDeduction: number;
  totalDeductions: number;

  // Net Pay
  netPay: number;

  // Employer Contributions & Liabilities (On-Costs)
  pensionEmployer: number; // 10%
  nsitfEmployer: number; // 1%
  itfEmployer: number; // 1%
  totalEmployerCost: number;

  exceptions: string[];
}

export interface PayrollBatchSummary {
  periodName: string;
  totalEmployees: number;
  totalGrossPay: number;
  totalNetPay: number;
  totalPayeTax: number;
  totalEmployeePension: number;
  totalEmployerPension: number;
  totalNhf: number;
  totalNsitf: number;
  totalItf: number;
  totalLoanDeductions: number;
  totalAdvanceDeductions: number;
  totalDeductions: number;
  totalEmployerCost: number;
  exceptionsCount: number;
  payslips: CalculatedPayslip[];
}

export class NigerianPayrollEngine {
  public static readonly DEFAULT_TAX_BRACKETS = [
    { cap: 300000, rate: 0.07 },
    { cap: 300000, rate: 0.11 },
    { cap: 500000, rate: 0.15 },
    { cap: 500000, rate: 0.19 },
    { cap: 1600000, rate: 0.21 },
    { cap: Infinity, rate: 0.24 },
  ];

  public static readonly NTA_2026_TAX_BRACKETS = [
    { cap: 800000, rate: 0 },
    { cap: 2200000, rate: 0.15 },
    { cap: 9000000, rate: 0.18 },
    { cap: 13000000, rate: 0.21 },
    { cap: 25000000, rate: 0.23 },
    { cap: Infinity, rate: 0.25 },
  ];

  /**
   * Calculate Annual PITA PAYE tax given annual Gross and allowable reliefs.
   */
  public static calculateAnnualPaye(
    annualGross: number,
    annualEmployeePension: number,
    annualNhf: number,
    config?: StatutoryConfigurationRule,
    additionalEligibleDeductions = 0
  ): number {
    if (annualGross <= 0) return 0;

    // Minimum Wage Exemption (PITA Section 37 / Finance Act):
    // Individuals whose gross income is at or below the National Minimum Wage are exempt
    // from Personal Income Tax (including minimum tax)
    // The Nigeria Tax Act exemption is regime-independent: employment income
    // at or below the national minimum wage is exempt from PIT. Keep the
    // legacy fallback for callers that do not provide a configuration.
    if (config?.minimumWageFloor && config.minimumWageFloor > 0) {
      const annualMinimumWage = config.minimumWageFloor * 12;
      if (annualGross <= annualMinimumWage) {
        return 0;
      }
    }

    const isNta2026 = config?.taxRegime === 'NTA_2026';
    const minTaxRate = config?.minimumTaxRate ?? 0.01;
    const minimumTax = annualGross * minTaxRate;

    if (isNta2026) {
      const chargeableIncome = Math.max(0, annualGross - annualEmployeePension - annualNhf - additionalEligibleDeductions);
      if (chargeableIncome <= 0) return 0;
      let remaining = chargeableIncome;
      let tax = 0;
      const brackets = config?.taxBands && config.taxBands.length > 0 ? config.taxBands : this.NTA_2026_TAX_BRACKETS;
      for (const band of brackets) {
        if (remaining <= 0) break;
        const cap = band.cap === null || band.cap === undefined ? Infinity : Number(band.cap);
        const taxableInBand = Math.min(remaining, cap);
        tax += taxableInBand * Number(band.rate);
        remaining -= taxableInBand;
      }
      return Math.round(tax * 100) / 100;
    }

    // 1. Consolidated Relief Allowance (CRA)
    const craBase = config?.craBaseAmount ?? 200000;
    const craHigherPct = config?.craHigherPercent ?? 0.01;
    const craPctGross = config?.craPercentGross ?? 0.20;

    const onePercentOrBase = Math.max(craBase, annualGross * craHigherPct);
    const twentyPercentGross = annualGross * craPctGross;
    const cra = onePercentOrBase + twentyPercentGross;

    // 2. Total Reliefs & Exemptions
    const totalReliefs = cra + annualEmployeePension + annualNhf;

    // 3. Taxable Income
    const taxableIncome = Math.max(0, annualGross - totalReliefs);

    if (taxableIncome <= 0) {
      return minimumTax;
    }

    // 4. Graduated Tax Brackets
    let remainingTaxable = taxableIncome;
    let tax = 0;

    const brackets = config?.taxBands && config.taxBands.length > 0
      ? config.taxBands
      : this.DEFAULT_TAX_BRACKETS;

    for (const b of brackets) {
      if (remainingTaxable <= 0) break;
      const rawCap = b.cap !== undefined && b.cap !== null
        ? b.cap
        : ((b as any).threshold !== undefined && (b as any).threshold !== null ? (b as any).threshold : Infinity);
      const cap = Number(rawCap) > 0 ? Number(rawCap) : Infinity;
      const taxableInBracket = Math.min(remainingTaxable, cap);
      tax += taxableInBracket * Number(b.rate);
      remainingTaxable -= taxableInBracket;
    }

    // Apply minimum tax if graduated tax is less
    return Math.max(tax, minimumTax);
  }

  /**
   * Process a single employee for a monthly payroll period.
   */
  public static calculateEmployee(
    input: EmployeePayrollInput,
    config?: StatutoryConfigurationRule
  ): CalculatedPayslip {
    const exceptions: string[] = [];

    const basicSalary = Number(input.baseSalary) || 0;
    const housingAllowance = Number(input.housingAllowance) || 0;
    const transportAllowance = Number(input.transportAllowance) || 0;
    const otherAllowances = Number(input.otherAllowances) || 0;
    const overtimeHours = Number(input.overtimeHours) || 0;
    const overtimeRate = Number(input.overtimeRate) || 0;
    const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;
    const bonuses = Number(input.bonuses) || 0;

    const grossPay =
      basicSalary +
      housingAllowance +
      transportAllowance +
      otherAllowances +
      overtimePay +
      bonuses;

    // Pension Emoluments base (Basic + Housing + Transport)
    const pensionEmoluments = basicSalary + housingAllowance + transportAllowance;

    // Pension rates
    const pensionEnabled = config?.pensionEnabled !== false && input.pensionApplicable !== false;
    const empPensionRate = config?.pensionEmployeeRate ?? 0.08;
    const emprPensionRate = config?.pensionEmployerRate ?? 0.10;
    const pensionEmployee = pensionEnabled ? Math.round(pensionEmoluments * empPensionRate * 100) / 100 : 0;
    const pensionEmployer = pensionEnabled ? Math.round(pensionEmoluments * emprPensionRate * 100) / 100 : 0;

    // NHF (2.5% of Basic)
    const nhfEnabled = config?.nhfEnabled !== false && input.nhfApplicable !== false && input.hasNhf !== false;
    const nhfRate = config?.nhfRate ?? 0.025;
    const nhfDeduction = nhfEnabled ? Math.round(basicSalary * nhfRate * 100) / 100 : 0;

    // Annualized figures for PITA calculation
    const annualGross = grossPay * 12;
    const annualPension = pensionEmployee * 12;
    const annualNhf = nhfDeduction * 12;
    const annualNhis = (Number(input.nhisMonthlyContribution) || 0) * 12;
    const annualRentRelief = Math.min(Math.max(0, Number(input.annualRentPaid) || 0) * 0.20, 500000);
    const annualLifeAssurance = Math.max(0, Number(input.annualLifeAssurance) || 0);
    const annualMortgageInterest = Math.max(0, Number(input.annualMortgageInterest) || 0);
    const additionalEligibleDeductions = annualNhis + annualRentRelief + annualLifeAssurance + annualMortgageInterest;

    const effectiveConfig: StatutoryConfigurationRule = {
      minimumWageFloor: 70000,
      ...config,
    };

    const annualPaye = this.calculateAnnualPaye(annualGross, annualPension, annualNhf, effectiveConfig, additionalEligibleDeductions);
    const payeTax = Math.round((annualPaye / 12) * 100) / 100;

    // Employer On-Costs
    const nsitfRate = config?.nsitfRate ?? 0.01;
    const itfRate = config?.itfRate ?? 0.01;
    const nsitfEmployer = Math.round(grossPay * nsitfRate * 100) / 100;
    const itfEmployer = Math.round(grossPay * itfRate * 100) / 100;
    const totalEmployerCost = Math.round((grossPay + pensionEmployer + nsitfEmployer + itfEmployer) * 100) / 100;

    // Non-statutory deductions
    const loanRepayment = Number(input.loanRepayment) || 0;
    const salaryAdvance = Number(input.salaryAdvanceRepayment) || 0;
    const penaltyDeduction = Number(input.penaltyDeduction) || 0;

    const totalDeductions = Math.round(
      (payeTax + pensionEmployee + nhfDeduction + annualNhis / 12 + loanRepayment + salaryAdvance + penaltyDeduction) * 100
    ) / 100;

    const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

    // Exception Checks
    if (!input.taxId) {
      exceptions.push('Missing State Tax Identification Number (TIN)');
    }
    if (!input.rsaPin) {
      exceptions.push('Missing Pension RSA PIN');
    }
    if (!input.bankAccountNumber || input.bankAccountNumber.length < 10) {
      exceptions.push('Invalid or missing bank account details');
    }
    if (netPay < 0) {
      exceptions.push('Negative net pay: deductions exceed gross earnings');
    }

    const craBase = config?.craBaseAmount ?? 200000;
    const craHigherPct = config?.craHigherPercent ?? 0.01;
    const craPctGross = config?.craPercentGross ?? 0.20;
    const annualCra = effectiveConfig.taxRegime === 'NTA_2026' ? 0 : Math.max(craBase, annualGross * craHigherPct) + annualGross * craPctGross;
    const cra = Math.round((annualCra / 12) * 100) / 100;
    const taxableIncome = effectiveConfig.taxRegime === 'NTA_2026'
      ? Math.max(0, Math.round((annualGross - annualPension - annualNhf - additionalEligibleDeductions) * 100) / 100)
      : Math.max(0, Math.round((grossPay - (cra + pensionEmployee + nhfDeduction)) * 100) / 100);

    return {
      staffId: input.staffId,
      name: input.name,
      employeeCode: input.employeeCode,
      department: input.department,
      position: input.position,
      bankName: input.bankName || '',
      bankAccountNumber: input.bankAccountNumber || '',
      bankSortCode: input.bankSortCode || '',
      bankAccountName: input.bankAccountName || input.name,
      bvn: input.bvn || '',
      taxId: input.taxId || '',
      rsaPin: input.rsaPin || '',
      pfaName: input.pfaName || '',
      basicSalary,
      housingAllowance,
      transportAllowance,
      otherAllowances,
      overtimePay,
      bonuses,
      grossPay,
      cra,
      taxableIncome,
      payeTax,
      pensionEmployee,
      nhfDeduction,
      nhisDeduction: Math.round((annualNhis / 12) * 100) / 100,
      eligibleReliefs: Math.round((additionalEligibleDeductions / 12) * 100) / 100,
      loanRepayment,
      salaryAdvance,
      penaltyDeduction,
      totalDeductions,
      netPay,
      pensionEmployer,
      nsitfEmployer,
      itfEmployer,
      totalEmployerCost,
      exceptions,
    };
  }

  /**
   * Process complete payroll batch for an entire hotel property.
   */
  public static calculateBatch(
    periodName: string,
    employees: EmployeePayrollInput[],
    config?: StatutoryConfigurationRule
  ): PayrollBatchSummary {
    const payslips = employees.map((emp) => this.calculateEmployee(emp, config));

    let totalGrossPay = 0;
    let totalNetPay = 0;
    let totalPayeTax = 0;
    let totalEmployeePension = 0;
    let totalEmployerPension = 0;
    let totalNhf = 0;
    let totalNsitf = 0;
    let totalItf = 0;
    let totalLoanDeductions = 0;
    let totalAdvanceDeductions = 0;
    let totalDeductions = 0;
    let totalEmployerCost = 0;
    let exceptionsCount = 0;

    for (const p of payslips) {
      totalGrossPay += p.grossPay;
      totalNetPay += p.netPay;
      totalPayeTax += p.payeTax;
      totalEmployeePension += p.pensionEmployee;
      totalEmployerPension += p.pensionEmployer;
      totalNhf += p.nhfDeduction;
      totalNsitf += p.nsitfEmployer;
      totalItf += p.itfEmployer;
      totalLoanDeductions += p.loanRepayment;
      totalAdvanceDeductions += p.salaryAdvance;
      totalDeductions += p.totalDeductions;
      totalEmployerCost += p.totalEmployerCost;
      if (p.exceptions.length > 0) exceptionsCount++;
    }

    return {
      periodName,
      totalEmployees: employees.length,
      totalGrossPay: Math.round(totalGrossPay * 100) / 100,
      totalNetPay: Math.round(totalNetPay * 100) / 100,
      totalPayeTax: Math.round(totalPayeTax * 100) / 100,
      totalEmployeePension: Math.round(totalEmployeePension * 100) / 100,
      totalEmployerPension: Math.round(totalEmployerPension * 100) / 100,
      totalNhf: Math.round(totalNhf * 100) / 100,
      totalNsitf: Math.round(totalNsitf * 100) / 100,
      totalItf: Math.round(totalItf * 100) / 100,
      totalLoanDeductions: Math.round(totalLoanDeductions * 100) / 100,
      totalAdvanceDeductions: Math.round(totalAdvanceDeductions * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalEmployerCost: Math.round(totalEmployerCost * 100) / 100,
      exceptionsCount,
      payslips,
    };
  }
}
