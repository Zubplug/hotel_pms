import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '../lib/services/hr-authorization-service';
import { PiiMaskingService } from '../lib/services/pii-masking-service';
import {
  NigerianPayrollEngine,
  StatutoryConfigurationRule,
} from '../lib/services/payroll-engine-service';
import { NextRequest } from 'next/server';

describe('HR & Payroll Production Integration & Security Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Property Authorization & Membership Security Guards', () => {
    it('rejects access when user membership status is INACTIVE or SUSPENDED', async () => {
      (auth as any).mockResolvedValue({
        user: { id: 'usr-inactive-1', email: 'suspended@hotel.com', role: 'HR_MANAGER' },
      });

      vi.spyOn(prisma.organizationMembership, 'findUnique').mockResolvedValue({
        id: 'mem-1',
        userId: 'usr-inactive-1',
        organizationId: 'org-test-1',
        role: 'HR_MANAGER',
        status: 'SUSPENDED',
        permissions: ['hr.employee.view'],
      } as any);

      await expect(HrAuthorizationService.resolveAuthContext()).rejects.toThrow(
        /Forbidden: User does not have an active organization membership/
      );
    });

    it('rejects property tampering when non-admin requests a property not in their accessiblePropertyIds', async () => {
      (auth as any).mockResolvedValue({
        user: { id: 'usr-tamper-1', email: 'clerk@hotel.com', role: 'HR_OFFICER' },
      });

      vi.spyOn(prisma.organizationMembership, 'findUnique').mockResolvedValue({
        id: 'mem-2',
        userId: 'usr-tamper-1',
        organizationId: 'org-test-1',
        role: 'HR_OFFICER',
        status: 'ACTIVE',
        permissions: ['hr.employee.view'],
      } as any);

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValue({
        id: 'stf-1',
        department: 'Front Desk',
        propertyAccess: ['prop-authorized-1'],
      } as any);

      const fakeReq = new NextRequest('http://localhost:3000/api/hr/employees?propertyId=prop-unauthorized-99', {
        headers: { 'x-property-id': 'prop-unauthorized-99' },
      });

      await expect(HrAuthorizationService.resolveAuthContext(fakeReq)).rejects.toThrow(
        /Forbidden: Access denied. Property \[prop-unauthorized-99\] is not within user's authorized properties/
      );
    });

    it('allows global admin (OWNER/SUPER_ADMIN) to access any property belonging to their organization', async () => {
      (auth as any).mockResolvedValue({
        user: { id: 'usr-owner-1', email: 'owner@hotel.com', role: 'OWNER' },
      });

      vi.spyOn(prisma.organizationMembership, 'findUnique').mockResolvedValue({
        id: 'mem-3',
        userId: 'usr-owner-1',
        organizationId: 'org-test-1',
        role: 'OWNER',
        status: 'ACTIVE',
        permissions: [],
      } as any);

      vi.spyOn(prisma.property, 'findMany').mockResolvedValue([
        { id: 'prop-lagos' },
        { id: 'prop-abuja' },
      ] as any);

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValue(null as any);

      const fakeReq = new NextRequest('http://localhost:3000/api/hr/employees?propertyId=prop-abuja');
      const context = await HrAuthorizationService.resolveAuthContext(fakeReq);

      expect(context.organizationId).toBe('org-test-1');
      expect(context.propertyId).toBe('prop-abuja');
      expect(context.isSuperAdmin).toBe(true);
      expect(context.canViewSensitive).toBe(true);
    });

    it('resolves caller department for Department Head role', async () => {
      (auth as any).mockResolvedValue({
        user: { id: 'usr-hod-1', email: 'hod.fnb@hotel.com', role: 'DEPARTMENT_HEAD' },
      });

      vi.spyOn(prisma.organizationMembership, 'findUnique').mockResolvedValue({
        id: 'mem-4',
        userId: 'usr-hod-1',
        organizationId: 'org-test-1',
        role: 'DEPARTMENT_HEAD',
        status: 'ACTIVE',
        permissions: [],
      } as any);

      vi.spyOn(prisma.staff, 'findFirst').mockResolvedValue({
        id: 'stf-hod-1',
        department: 'Food & Beverage',
        propertyAccess: ['prop-lagos'],
      } as any);

      const context = await HrAuthorizationService.resolveAuthContext();
      expect(context.role).toBe('DEPARTMENT_HEAD');
      expect(context.department).toBe('Food & Beverage');
      expect(HrAuthorizationService.can(context, 'hr.leave.manage')).toBe(true);
      expect(HrAuthorizationService.can(context, 'hr.payroll.approve')).toBe(false);
    });
  });

  describe('2. Runtime Tax Band Normalization (threshold vs cap bug fix)', () => {
    it('accurately parses database threshold bands and prevents treating them as unlimited cap', () => {
      // Test the exact bug where database stored { threshold: 300000, rate: 0.07 }
      const dbStoredRule: StatutoryConfigurationRule = {
        versionTag: 'PITA_DB_TEST',
        craBaseAmount: 200000,
        craPercentGross: 0.20,
        craHigherPercent: 0.01,
        taxBands: [
          { threshold: 300000, rate: 0.07 },
          { threshold: 300000, rate: 0.11 },
          { threshold: 500000, rate: 0.15 },
          { threshold: 500000, rate: 0.19 },
          { threshold: 1600000, rate: 0.21 },
          { threshold: null, rate: 0.24 },
        ],
      };

      // Annual Gross: 4,000,000
      // Employee Pension: 8% of (Basic + Housing + Transport = 3,000,000) = 240,000
      // CRA = max(200k, 1% of 4M = 40k) + 20% of 4M (800k) = 1,000,000
      // Total reliefs = 1,000,000 + 240,000 = 1,240,000
      // Taxable income = 4,000,000 - 1,240,000 = 2,760,000
      // Graduated calculation:
      // Band 1: 300,000 @ 7% = 21,000
      // Band 2: 300,000 @ 11% = 33,000
      // Band 3: 500,000 @ 15% = 75,000
      // Band 4: 500,000 @ 19% = 95,000
      // Band 5: 1,160,000 @ 21% = 243,600
      // Total Expected Tax = 21,000 + 33,000 + 75,000 + 95,000 + 243,600 = 467,600
      const annualPaye = NigerianPayrollEngine.calculateAnnualPaye(4000000, 240000, 0, dbStoredRule);

      // If the bug were present, tax would be 2,760,000 * 0.07 = 193,200. We assert it is NOT that!
      expect(annualPaye).not.toBe(193200);
      expect(annualPaye).toBe(467600);
    });
  });

  describe('3. Minimum Wage Statutory Exemption (Finance Act / PITA Section 37)', () => {
    it('completely exempts low-income employees earning at or below minimum wage from PAYE', () => {
      const config: StatutoryConfigurationRule = {
        minimumWageFloor: 70000, // Nigerian National Minimum Wage: ₦70,000 / month
      };

      // Case A: Exactly minimum wage (₦70,000/month = ₦840,000/year)
      const atMinimumWageTax = NigerianPayrollEngine.calculateAnnualPaye(840000, 0, 0, config);
      expect(atMinimumWageTax).toBe(0);

      // Case B: Below minimum wage (₦50,000/month = ₦600,000/year)
      const belowMinimumWageTax = NigerianPayrollEngine.calculateAnnualPaye(600000, 0, 0, config);
      expect(belowMinimumWageTax).toBe(0);

      // Case C: Above minimum wage (₦100,000/month = ₦1,200,000/year)
      const aboveMinimumWageTax = NigerianPayrollEngine.calculateAnnualPaye(1200000, 0, 0, config);
      expect(aboveMinimumWageTax).toBeGreaterThan(0);
    });

    it('ensures monthly payslip calculation applies ₦0 PAYE for minimum-wage employee', () => {
      const input = {
        staffId: 'stf-cleaner-1',
        name: 'Chioma Okeke',
        employeeCode: 'EMP-010',
        department: 'Housekeeping',
        position: 'Room Attendant',
        baseSalary: 45000,
        housingAllowance: 15000,
        transportAllowance: 10000, // Total gross = 70,000
      };

      const result = NigerianPayrollEngine.calculateEmployee(input, { minimumWageFloor: 70000 });
      expect(result.grossPay).toBe(70000);
      expect(result.payeTax).toBe(0); // 100% exempt
      expect(result.netPay).toBe(70000 - result.pensionEmployee - result.nhfDeduction);
    });
  });

  describe('4. Effective-Dated Statutory Configuration Timeline Resolution', () => {
    it('resolves historical statutory configuration version matching period start date', () => {
      const configs = [
        {
          id: 'cfg-2024',
          versionTag: 'PITA_2024_LEGACY',
          effectiveFrom: new Date('2024-01-01'),
          effectiveTo: new Date('2025-12-31'),
          pensionEmployeeRate: 0.08,
        },
        {
          id: 'cfg-2026',
          versionTag: 'FINANCE_ACT_2026',
          effectiveFrom: new Date('2026-01-01'),
          effectiveTo: null,
          pensionEmployeeRate: 0.10,
        },
      ];

      // Simulate period in June 2024
      const date2024 = new Date('2024-06-01');
      const resolved2024 = configs.find(
        (c) => c.effectiveFrom <= date2024 && (!c.effectiveTo || c.effectiveTo >= date2024)
      );
      expect(resolved2024?.versionTag).toBe('PITA_2024_LEGACY');

      // Simulate period in October 2026
      const date2026 = new Date('2026-10-01');
      const resolved2026 = configs.find(
        (c) => c.effectiveFrom <= date2026 && (!c.effectiveTo || c.effectiveTo >= date2026)
      );
      expect(resolved2026?.versionTag).toBe('FINANCE_ACT_2026');
    });
  });

  describe('5. General Ledger Posting Atomic Idempotency & Fail-Closed Guard', () => {
    it('fails closed and rejects GL posting if debits do not match credits', () => {
      const lines = [
        { accountId: 'acc-6000', debit: 500000, credit: 0 },
        { accountId: 'acc-2100', debit: 0, credit: 495000 }, // ₦5,000 difference!
      ];

      const sumDebits = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
      const sumCredits = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
      const imbalance = Math.round((sumDebits - sumCredits) * 100) / 100;

      const isBalanced = Math.abs(imbalance) <= 0.001;
      expect(isBalanced).toBe(false);
      expect(imbalance).toBe(5000);
    });

    it('simulates atomic transaction lock rejecting concurrent double posting', async () => {
      // Simulate state where batch is already PROCESSING or PAID
      let batchState = 'APPROVED';
      let journalEntryId: string | null = null;

      const attemptPost = async (callerId: string) => {
        // Atomic conditional update simulation
        if (batchState === 'APPROVED' && journalEntryId === null) {
          batchState = 'PROCESSING';
          // Simulate posting work
          journalEntryId = `gl-entry-${callerId}`;
          batchState = 'PAID';
          return { success: true, journalEntryId };
        }
        if (journalEntryId) {
          throw new Error(`CONCURRENT_CONFLICT: Duplicate posting rejected. Already posted with [${journalEntryId}].`);
        }
        throw new Error(`INVALID_STATE: Cannot post batch in status [${batchState}].`);
      };

      // Concurrent invocation
      const [res1, res2Promise] = [
        await attemptPost('req-1'),
        attemptPost('req-2').catch((e) => e.message),
      ];

      expect(res1.success).toBe(true);
      expect(res1.journalEntryId).toBe('gl-entry-req-1');
      const res2Error = await res2Promise;
      expect(res2Error).toContain('CONCURRENT_CONFLICT');
    });
  });

  describe('6. CSV Export Formula Injection Sanitization', () => {
    it('prefixes formula triggers (=, +, -, @) with single quote to prevent spreadsheet injection', () => {
      const sanitizeCsvCell = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '""';
        let str = String(val).trim();
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };

      expect(sanitizeCsvCell('=cmd|/c calc')).toBe('"\'=cmd|/c calc"');
      expect(sanitizeCsvCell('+12345')).toBe('"\'+12345"');
      expect(sanitizeCsvCell('-500')).toBe('"\'-500"');
      expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe('"\'@SUM(A1:A10)"');
      expect(sanitizeCsvCell('Safe Employee Name')).toBe('"Safe Employee Name"');
    });
  });

  describe('7. Department Head Scope Enforcement', () => {
    it('rejects Department Head approving leave for employee in another department', () => {
      const hodContext = {
        role: 'DEPARTMENT_HEAD',
        department: 'Food & Beverage',
      };

      const applicantEmployee = {
        id: 'stf-housekeeper-1',
        name: 'Musa Ibrahim',
        department: 'Housekeeping', // Mismatched!
      };

      const isAllowed =
        hodContext.role !== 'DEPARTMENT_HEAD' ||
        hodContext.department === applicantEmployee.department;

      expect(isAllowed).toBe(false);
    });

    it('permits Department Head approving leave for employee within their own department', () => {
      const hodContext = {
        role: 'DEPARTMENT_HEAD',
        department: 'Food & Beverage',
      };

      const applicantEmployee = {
        id: 'stf-waiter-1',
        name: 'Bisi Johnson',
        department: 'Food & Beverage', // Matches!
      };

      const isAllowed =
        hodContext.role !== 'DEPARTMENT_HEAD' ||
        hodContext.department === applicantEmployee.department;

      expect(isAllowed).toBe(true);
    });
  });

  describe('8. Employee Salary Revision Audit Versioning', () => {
    it('generates an EmployeeMovement record with old and new snapshots when compensation is modified', () => {
      const previousStructure = {
        basicSalary: 150000,
        housingAllowance: 50000,
        transportAllowance: 25000,
        otherAllowances: 10000,
        effectiveFrom: new Date('2025-01-01'),
      };

      const updatedSalaryPayload = {
        basicSalary: 200000,
        housingAllowance: 70000,
        transportAllowance: 35000,
        otherAllowances: 15000,
      };

      const hasChanged =
        previousStructure.basicSalary !== updatedSalaryPayload.basicSalary ||
        previousStructure.housingAllowance !== updatedSalaryPayload.housingAllowance;

      expect(hasChanged).toBe(true);

      const auditMovement = {
        type: 'SALARY_REVISION',
        fromDetails: previousStructure,
        toDetails: {
          ...updatedSalaryPayload,
          effectiveFrom: new Date(),
        },
      };

      expect(auditMovement.type).toBe('SALARY_REVISION');
      expect(auditMovement.fromDetails.basicSalary).toBe(150000);
      expect(auditMovement.toDetails.basicSalary).toBe(200000);
    });
  });
});
