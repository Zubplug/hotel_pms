import { describe, it, expect } from 'vitest';
import { NigerianPayrollEngine, EmployeePayrollInput } from '../lib/services/payroll-engine-service';

describe('Nigerian Statutory Payroll Engine', () => {
  describe('calculateAnnualPaye', () => {
    it('returns 0 tax for zero or negative gross', () => {
      expect(NigerianPayrollEngine.calculateAnnualPaye(0, 0, 0)).toBe(0);
      expect(NigerianPayrollEngine.calculateAnnualPaye(-1000, 0, 0)).toBe(0);
    });

    it('enforces 1% minimum tax floor when reliefs exceed or equal gross', () => {
      // Annual gross ₦180,000 (₦15,000/mo)
      // 1% minimum tax = ₦1,800
      const annualGross = 180000;
      const pension = 0;
      const nhf = 0;
      const tax = NigerianPayrollEngine.calculateAnnualPaye(annualGross, pension, nhf);
      expect(tax).toBe(1800);
    });

    it('accurately computes graduated PITA tax brackets and CRA', () => {
      // Annual Gross: ₦4,200,000 (₦350,000/mo)
      // Pension (8% of 350k * 12) = ₦336,000
      // NHF (2.5% of 200k * 12) = ₦60,000
      // CRA: max(200k, 42k) + 20% of 4.2M = 200k + 840k = ₦1,040,000
      // Total reliefs: 1,040,000 + 336,000 + 60,000 = ₦1,436,000
      // Taxable: 4,200,000 - 1,436,000 = ₦2,764,000
      // 300k @ 7% = 21,000
      // 300k @ 11% = 33,000
      // 500k @ 15% = 75,000
      // 500k @ 19% = 95,000
      // 1,164,000 @ 21% = 244,440
      // Total = 468,440
      const annualGross = 4200000;
      const annualPension = 336000;
      const annualNhf = 60000;

      const tax = NigerianPayrollEngine.calculateAnnualPaye(annualGross, annualPension, annualNhf);
      expect(tax).toBeCloseTo(468440, 2);
    });
  });

  describe('calculateEmployee', () => {
    it('computes complete monthly statutory deductions and employer on-costs', () => {
      const input: EmployeePayrollInput = {
        staffId: 'staff-101',
        name: 'Chidi Okafor',
        employeeCode: 'EMP-001',
        department: 'Food & Beverage',
        position: 'Head Chef',
        bankName: 'Zenith Bank',
        bankAccountNumber: '1012345678',
        taxId: 'TIN-LAG-8899',
        rsaPin: 'PEN100998877',
        baseSalary: 200000,
        housingAllowance: 100000,
        transportAllowance: 50000,
        otherAllowances: 10000,
        overtimeHours: 5,
        overtimeRate: 2000, // ₦10,000 overtime pay
        bonuses: 15000,
        loanRepayment: 10000,
        hasNhf: true,
      };

      const result = NigerianPayrollEngine.calculateEmployee(input);

      // Gross = 200k + 100k + 50k + 10k + 10k(OT) + 15k(Bonus) = 385,000
      expect(result.grossPay).toBe(385000);
      expect(result.overtimePay).toBe(10000);

      // Pension base = basic + housing + transport = 350,000
      // Employee Pension (8%) = 28,000
      expect(result.pensionEmployee).toBe(28000);
      // Employer Pension (10%) = 35,000
      expect(result.pensionEmployer).toBe(35000);

      // NHF = 2.5% of basic (200k) = 5,000
      expect(result.nhfDeduction).toBe(5000);

      // Employer on-costs:
      // NSITF = 1% of gross (385k) = 3,850
      expect(result.nsitfEmployer).toBe(3850);
      // ITF = 1% of gross (385k) = 3,850
      expect(result.itfEmployer).toBe(3850);

      // Total Employer Cost = Gross (385k) + Employer Pension (35k) + NSITF (3850) + ITF (3850) = 427,700
      expect(result.totalEmployerCost).toBe(427700);

      // Deductions = PAYE + 28,000 + 5,000 + 10,000(Loan)
      expect(result.totalDeductions).toBe(
        result.payeTax + result.pensionEmployee + result.nhfDeduction + result.loanRepayment + result.salaryAdvance
      );

      // Net Pay = Gross - Deductions
      expect(result.netPay).toBe(Math.round((result.grossPay - result.totalDeductions) * 100) / 100);

      // Clean record should have 0 exceptions
      expect(result.exceptions).toHaveLength(0);
    });

    it('flags exceptions for missing compliance credentials', () => {
      const incompleteInput: EmployeePayrollInput = {
        staffId: 'staff-102',
        name: 'Amina Bello',
        employeeCode: 'EMP-002',
        department: 'Front Office',
        position: 'Receptionist',
        baseSalary: 120000,
        // Missing taxId, rsaPin, and bank details
      };

      const result = NigerianPayrollEngine.calculateEmployee(incompleteInput);

      expect(result.exceptions).toContain('Missing State Tax Identification Number (TIN)');
      expect(result.exceptions).toContain('Missing Pension RSA PIN');
      expect(result.exceptions).toContain('Invalid or missing bank account details');
    });

    it('flags exception when total deductions exceed gross earnings resulting in negative net pay', () => {
      const indebtedInput: EmployeePayrollInput = {
        staffId: 'staff-103',
        name: 'John Doe',
        employeeCode: 'EMP-003',
        department: 'Housekeeping',
        position: 'Room Attendant',
        baseSalary: 50000,
        bankAccountNumber: '0123456789',
        taxId: 'TIN-001',
        rsaPin: 'PEN-001',
        loanRepayment: 60000, // exceeds basic salary
      };

      const result = NigerianPayrollEngine.calculateEmployee(indebtedInput);
      expect(result.netPay).toBeLessThan(0);
      expect(result.exceptions).toContain('Negative net pay: deductions exceed gross earnings');
    });
  });

  describe('calculateBatch', () => {
    it('aggregates all employee payslips and statutory totals with perfect consistency', () => {
      const staffList: EmployeePayrollInput[] = [
        {
          staffId: 'staff-1',
          name: 'Staff One',
          employeeCode: 'EMP-01',
          department: 'Kitchen',
          position: 'Cook',
          baseSalary: 150000,
          housingAllowance: 50000,
          transportAllowance: 30000,
          bankAccountNumber: '1234567890',
          taxId: 'TIN-1',
          rsaPin: 'PEN-1',
        },
        {
          staffId: 'staff-2',
          name: 'Staff Two',
          employeeCode: 'EMP-02',
          department: 'Security',
          position: 'Guard',
          baseSalary: 100000,
          housingAllowance: 20000,
          transportAllowance: 10000,
          bankAccountNumber: '9876543210',
          taxId: 'TIN-2',
          rsaPin: 'PEN-2',
        },
      ];

      const batch = NigerianPayrollEngine.calculateBatch('October 2026', staffList);

      expect(batch.totalEmployees).toBe(2);
      expect(batch.totalGrossPay).toBe(batch.payslips[0].grossPay + batch.payslips[1].grossPay);
      expect(batch.totalNetPay).toBe(
        Math.round((batch.payslips[0].netPay + batch.payslips[1].netPay) * 100) / 100
      );
      expect(batch.totalPayeTax).toBe(
        Math.round((batch.payslips[0].payeTax + batch.payslips[1].payeTax) * 100) / 100
      );
      expect(batch.totalEmployeePension).toBe(
        Math.round((batch.payslips[0].pensionEmployee + batch.payslips[1].pensionEmployee) * 100) / 100
      );
      expect(batch.totalEmployerPension).toBe(
        Math.round((batch.payslips[0].pensionEmployer + batch.payslips[1].pensionEmployer) * 100) / 100
      );
      expect(batch.totalEmployerCost).toBe(
        Math.round((batch.payslips[0].totalEmployerCost + batch.payslips[1].totalEmployerCost) * 100) / 100
      );
    });
  });
});
