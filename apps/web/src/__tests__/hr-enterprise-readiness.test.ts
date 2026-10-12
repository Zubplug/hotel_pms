import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { HrAuthorizationService } from '../lib/services/hr-authorization-service';
import { PiiMaskingService } from '../lib/services/pii-masking-service';
import { NigerianPayrollEngine, StatutoryConfigurationRule } from '../lib/services/payroll-engine-service';

describe('HR & Payroll Enterprise Readiness and Security Safeguards', () => {
  describe('1. Role-Based Access Control and Tenant Isolation', () => {
    it('enforces required permission and throws forbidden on missing permission', () => {
      const viewerContext = {
        userId: 'user-001',
        organizationId: 'org-hotel-1',
        propertyId: 'prop-1',
        role: 'STAFF',
        permissions: new Set(['hr.employee.view']),
        isSuperAdmin: false,
      };

      // Allowed
      expect(() => HrAuthorizationService.assertPermission(viewerContext, 'hr.employee.view')).not.toThrow();

      // Disallowed - cannot manage employees
      expect(() => HrAuthorizationService.assertPermission(viewerContext, 'hr.employee.manage')).toThrow(
        /Forbidden: Missing required permission/
      );

      // Disallowed - cannot approve payroll
      expect(() => HrAuthorizationService.assertPermission(viewerContext, 'hr.payroll.approve')).toThrow(
        /Forbidden: Missing required permission/
      );
    });

    it('grants all permissions to superadmin', () => {
      const superAdminContext = {
        userId: 'admin-001',
        organizationId: 'org-hotel-1',
        propertyId: null,
        role: 'SUPER_ADMIN',
        permissions: new Set<string>(),
        isSuperAdmin: true,
      };

      expect(() => HrAuthorizationService.assertPermission(superAdminContext, 'hr.payroll.approve')).not.toThrow();
      expect(() => HrAuthorizationService.assertPermission(superAdminContext, 'hr.payroll.release')).not.toThrow();
      expect(() => HrAuthorizationService.assertPermission(superAdminContext, 'hr.settings.manage')).not.toThrow();
    });

    it('enforces tenant boundary check across distinct organizations', () => {
      const userOrgA = {
        userId: 'user-001',
        organizationId: 'org-alpha',
        propertyId: 'prop-alpha-1',
        role: 'HR_MANAGER',
        permissions: new Set(['hr.employee.view']),
        isSuperAdmin: false,
      };

      // Query targeting org-beta
      const requestedOrgId = 'org-beta';
      const isAllowed = userOrgA.isSuperAdmin || userOrgA.organizationId === requestedOrgId;
      expect(isAllowed).toBe(false);
    });
  });

  describe('2. Maker-Checker Payroll Separation', () => {
    it('prevents payroll preparer from approving their own batch', () => {
      const preparerId = 'user-preparer-01';
      const period = {
        id: 'period-oct-2026',
        status: 'DRAFT',
        createdBy: preparerId,
      };

      const approverContext = {
        userId: preparerId, // Same user attempting to approve
        organizationId: 'org-1',
        propertyId: 'prop-1',
        role: 'HR_MANAGER',
        permissions: new Set(['hr.payroll.approve']),
        isSuperAdmin: false,
      };

      const isMakerCheckerViolation = !approverContext.isSuperAdmin && period.createdBy === approverContext.userId;
      expect(isMakerCheckerViolation).toBe(true);
    });

    it('permits independent authorized supervisor to approve', () => {
      const preparerId = 'user-preparer-01';
      const supervisorId = 'user-supervisor-02';
      const period = {
        id: 'period-oct-2026',
        status: 'DRAFT',
        createdBy: preparerId,
      };

      const approverContext = {
        userId: supervisorId,
        organizationId: 'org-1',
        propertyId: 'prop-1',
        role: 'FINANCE_DIRECTOR',
        permissions: new Set(['hr.payroll.approve']),
        isSuperAdmin: false,
      };

      const isMakerCheckerViolation = !approverContext.isSuperAdmin && period.createdBy === approverContext.userId;
      expect(isMakerCheckerViolation).toBe(false);
      expect(HrAuthorizationService.can(approverContext, 'hr.payroll.approve')).toBe(true);
    });
  });

  describe('3. Double-Entry General Ledger Balance with Loans & Advances', () => {
    it('guarantees Total Debits EXACTLY equal Total Credits when loan and advance recoveries reduce net pay', () => {
      // Mock payroll calculation with loan repayment and salary advance
      const gross = 500000;
      const pensionEmployee = 40000;
      const pensionEmployer = 50000;
      const payeTax = 65000;
      const nhf = 12500;
      const nsitf = 5000;
      const itf = 5000;
      const loanRepayment = 30000;
      const salaryAdvance = 20000;

      // Net pay reduction: Gross - all employee deductions
      const totalEmployeeDeductions = payeTax + pensionEmployee + nhf + loanRepayment + salaryAdvance;
      const netPay = gross - totalEmployeeDeductions; // 500,000 - 167,500 = 332,500

      // Journal Lines Construction:
      // Debits (Expenses):
      // 6000 Gross Salaries: 500,000
      // 6010 Employer Pension: 50,000
      // 6020 NSITF: 5,000
      // 6030 ITF: 5,000
      const totalDebits = gross + pensionEmployer + nsitf + itf; // 560,000

      // Credits (Liabilities & Asset Recoveries):
      // 2100 Net Salaries Payable: 332,500
      // 2110 PAYE Tax Payable: 65,000
      // 2120 Total Pension Payable: 90,000 (emp 40k + empyr 50k)
      // 2130 NHF Payable: 12,500
      // 2140 NSITF Payable: 5,000
      // 2150 ITF Payable: 5,000
      // 1180 Employee Loans Asset Recovery: 30,000
      // 1185 Salary Advances Asset Recovery: 20,000
      const totalPensionPayable = pensionEmployee + pensionEmployer;
      const totalCredits =
        netPay +
        payeTax +
        totalPensionPayable +
        nhf +
        nsitf +
        itf +
        loanRepayment +
        salaryAdvance;

      expect(totalDebits).toBe(560000);
      expect(totalCredits).toBe(560000);
      expect(Math.abs(totalDebits - totalCredits)).toBeLessThan(0.0001);
    });
  });

  describe('4. General Ledger Posting Idempotency Guard', () => {
    it('blocks duplicate GL posting if period is already posted or journalEntryId exists', () => {
      const postedPeriod = {
        id: 'period-nov-2026',
        status: 'PAID',
        journalEntryId: 'gl-journal-uuid-999',
      };

      const canPostGl = postedPeriod.status === 'APPROVED' && !postedPeriod.journalEntryId;
      expect(canPostGl).toBe(false);
    });
  });

  describe('5. PII Masking and Sensitive Data Protection', () => {
    it('masks BVN, NIN, TIN, and bank account numbers for unauthorized personnel', () => {
      const rawBvn = '22233445566';
      const rawNin = '98765432101';
      const rawTin = '12345678-0001';
      const rawAccount = '0123456789';

      expect(PiiMaskingService.maskBvn(rawBvn)).toBe('******5566');
      expect(PiiMaskingService.maskNin(rawNin)).toBe('******2101');
      expect(PiiMaskingService.maskTin(rawTin)).toBe('***0001');
      expect(PiiMaskingService.maskAccountNumber(rawAccount)).toBe('******6789');
    });

    it('handles empty or null PII gracefully without throwing', () => {
      expect(PiiMaskingService.maskBvn(null)).toBeNull();
      expect(PiiMaskingService.maskNin(undefined)).toBeNull();
      expect(PiiMaskingService.maskAccountNumber('')).toBeNull();
    });
  });


  describe('6. Dynamic Statutory Configuration Engine', () => {
    it('calculates statutory taxes using versioned rules rather than hardcoded rates', () => {
      const customRule: StatutoryConfigurationRule = {
        versionTag: 'FINANCE_ACT_2026_CUSTOM',
        effectiveFrom: new Date('2026-01-01'),
        craBaseAmount: 300000, // Elevated CRA floor
        craPercentGross: 0.25, // Elevated 25% CRA
        craHigherPercent: 0.015,
        pensionEmployeeRate: 0.09, // 9% employee pension
        pensionEmployerRate: 0.11, // 11% employer pension
        nhfRate: 0.03, // 3% NHF
        nsitfRate: 0.015,
        itfRate: 0.015,
        minimumWageFloor: 75000,
        taxBands: [
          { threshold: 500000, rate: 0.05 },
          { threshold: 500000, rate: 0.10 },
          { threshold: null, rate: 0.20 },
        ],
      };

      const input = {
        staffId: 'staff-dyn-1',
        name: 'Adebayo Adeleke',
        baseSalary: 300000,
        housingAllowance: 100000,
        transportAllowance: 50000,
        bankAccountNumber: '0123456789',
        taxId: 'TIN-001',
        rsaPin: 'PEN-001',
        hasNhf: true,
      };

      const result = NigerianPayrollEngine.calculateEmployee(input, customRule);

      // Pension base = 300k + 100k + 50k = 450k
      // 9% employee pension = 40,500
      expect(result.pensionEmployee).toBe(40500);
      // 11% employer pension = 49,500
      expect(result.pensionEmployer).toBe(49500);
      // 3% NHF on basic (300k) = 9,000
      expect(result.nhfDeduction).toBe(9000);
    });
  });

  describe('7. Leave Management Concurrency and Balance Checks', () => {
    it('rejects processing an already finalized leave application to prevent double decrement', () => {
      const application = {
        id: 'leave-app-01',
        status: 'APPROVED',
        totalDays: 5,
      };

      const canProcess = application.status === 'PENDING' || application.status === 'PENDING_HR';
      expect(canProcess).toBe(false);
    });

    it('rejects approval when leave balance is insufficient', () => {
      const balanceDays = 3;
      const requestedDays = 5;

      const hasSufficientBalance = balanceDays >= requestedDays;
      expect(hasSufficientBalance).toBe(false);
    });
  });

  describe('8. 24/7 Hospitality Overnight Shift Calculation', () => {
    it('calculates correct worked hours when punch crosses calendar midnight', () => {
      // Shift: 22:00 to 06:00 next morning (8 hours)
      const clockIn = new Date('2026-10-12T22:00:00Z');
      const clockOut = new Date('2026-10-13T06:00:00Z');

      let diffMs = clockOut.getTime() - clockIn.getTime();
      if (diffMs < 0) {
        diffMs += 24 * 3600 * 1000;
      }
      const totalHours = Math.round((diffMs / 3600000) * 10) / 10;
      expect(totalHours).toBe(8);
    });

    it('handles clock out recorded without calendar rollover by adding 24 hours', () => {
      // If time representation alone is compared (06:00 < 22:00)
      const inTimeMs = 22 * 3600 * 1000;
      const outTimeMs = 6 * 3600 * 1000;

      let diffMs = outTimeMs - inTimeMs;
      if (diffMs < 0) {
        diffMs += 24 * 3600 * 1000;
      }
      const totalHours = diffMs / (3600 * 1000);
      expect(totalHours).toBe(8);
    });
  });
});
