import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { requireOrganizationContext } from '@/lib/organization-access';
import { PiiMaskingService } from '@/lib/services/pii-masking-service';
import { initiateFlutterwavePayroll } from '@/lib/services/flutterwave-payroll-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

async function getOrCreateGlAccount(
  propertyId: string,
  code: string,
  name: string,
  type: any,
  category: string,
  normalBalance: 'DEBIT' | 'CREDIT'
) {
  let acc = await prisma.chartOfAccount.findUnique({
    where: { propertyId_code: { propertyId, code } },
  });
  if (!acc) {
    acc = await prisma.chartOfAccount.create({
      data: {
        propertyId,
        code,
        name,
        type,
        category,
        normalBalance,
        isActive: true,
      },
    });
  }
  return acc;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.view');

    const { id } = await params;

    // Strict multi-tenant query
    const period = await prisma.payrollPeriod.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
        propertyId: context.propertyId,
      },
      include: {
        property: { select: { id: true, name: true } },
        payslips: {
          where: context.role === 'DEPARTMENT_HEAD' && context.department
            ? { staff: { department: context.department } }
            : undefined,
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: true,
                position: true,
                employeeId: true,
                employeeProfile: true,
                salaryStructure: true,
              },
            },
            components: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!period) {
      return NextResponse.json(
        { error: 'Payroll batch not found or access denied for active property' },
        { status: 404 }
      );
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalPaye = 0;
    let totalEmployeePension = 0;
    let totalEmployerPension = 0;
    let totalNhf = 0;
    let totalNsitf = 0;
    let totalItf = 0;
    let totalLoanDeductions = 0;
    let totalAdvanceDeductions = 0;

    const formattedPayslips = period.payslips.map((ps) => {
      totalGross += Number(ps.grossEarnings);
      totalNet += Number(ps.netPay);

      let paye = 0;
      let pEmp = 0;
      let pEmpr = 0;
      let nhf = 0;
      let nsitf = 0;
      let itf = 0;
      let loans = 0;
      let advances = 0;

      for (const c of ps.components) {
        const amt = Number(c.amount);
        if (c.name.includes('PAYE')) paye += amt;
        else if (c.name.includes('Pension Employee')) pEmp += amt;
        else if (c.name.includes('Pension Employer')) pEmpr += amt;
        else if (c.name.includes('NHF')) nhf += amt;
        else if (c.name.includes('NSITF')) nsitf += amt;
        else if (c.name.includes('ITF')) itf += amt;
        else if (c.name.includes('Loan')) loans += amt;
        else if (c.name.includes('Advance')) advances += amt;
      }

      totalPaye += paye;
      totalEmployeePension += pEmp;
      totalEmployerPension += pEmpr;
      totalNhf += nhf;
      totalNsitf += nsitf;
      totalItf += itf;
      totalLoanDeductions += loans;
      totalAdvanceDeductions += advances;

      return {
        id: ps.id,
        staffId: ps.staffId,
        name: `${ps.staff.firstName || ''} ${ps.staff.lastName || ''}`.trim(),
        employeeCode: ps.staff.employeeId || `EMP-${ps.staff.id.slice(0, 4)}`,
        department: ps.staff.department || 'General',
        position: ps.staff.position || 'Staff',
        bankName: ps.bankName || 'Not Set',
        bankAccountNumber: PiiMaskingService.maskAccountNumber(
          ps.accountNumber,
          context.canViewSensitive
        ),
        grossPay: context.canViewSensitive ? Number(ps.grossEarnings) : null,
        deductions: context.canViewSensitive ? Number(ps.totalDeductions) : null,
        netPay: context.canViewSensitive ? Number(ps.netPay) : null,
        status: ps.status,
        components: ps.components.map((c) => ({
          name: c.name,
          type: c.type,
          amount: context.canViewSensitive ? Number(c.amount) : null,
        })),
      };
    });

    return NextResponse.json({
      period: {
        id: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
        createdBy: period.createdBy,
        approvedBy: period.approvedBy,
        approvedAt: period.approvedAt,
        journalEntryId: period.journalEntryId,
        paymentStatus: period.paymentStatus,
        paymentBatchRef: period.paymentBatchRef,
        approvalTrail: period.approvalTrail,
        propertyId: period.propertyId,
        propertyName: period.property.name,
        totalGross: context.canViewSensitive ? Math.round(totalGross * 100) / 100 : null,
        totalNet: context.canViewSensitive ? Math.round(totalNet * 100) / 100 : null,
        totalPaye: context.canViewSensitive ? Math.round(totalPaye * 100) / 100 : null,
        totalEmployeePension: context.canViewSensitive ? Math.round(totalEmployeePension * 100) / 100 : null,
        totalEmployerPension: context.canViewSensitive ? Math.round(totalEmployerPension * 100) / 100 : null,
        totalNhf: context.canViewSensitive ? Math.round(totalNhf * 100) / 100 : null,
        totalNsitf: context.canViewSensitive ? Math.round(totalNsitf * 100) / 100 : null,
        totalItf: context.canViewSensitive ? Math.round(totalItf * 100) / 100 : null,
        totalLoanDeductions: context.canViewSensitive ? Math.round(totalLoanDeductions * 100) / 100 : null,
        totalAdvanceDeductions: context.canViewSensitive ? Math.round(totalAdvanceDeductions * 100) / 100 : null,
        totalEmployerCost: context.canViewSensitive ? Math.round((totalGross + totalEmployerPension + totalNsitf + totalItf) * 100) / 100 : null,
        payslips: formattedPayslips,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get payroll batch details:', error);
    return NextResponse.json({ error: 'Failed to retrieve batch' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, notes } = body;

    // 1. APPROVE ACTION: Requires Maker-Checker validation
    if (action === 'APPROVE') {
      const context = await HrAuthorizationService.resolveAuthContext(req);
      HrAuthorizationService.assertPermission(context, 'hr.payroll.approve');

      const period = await prisma.payrollPeriod.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
          propertyId: context.propertyId,
        },
      });

      if (!period) {
        return NextResponse.json({ error: 'Payroll batch not found' }, { status: 404 });
      }

      // MAKER-CHECKER ENFORCEMENT
      if (period.createdBy === context.userId && !context.isSuperAdmin) {
        return NextResponse.json(
          {
            error: 'Maker-checker violation: The creator of a payroll batch cannot approve it. An independent approver must review and approve.',
          },
          { status: 403 }
        );
      }

      if (period.status !== 'DRAFT') {
        return NextResponse.json(
          { error: `Invalid batch status: Batch must be in DRAFT to approve (current: ${period.status})` },
          { status: 400 }
        );
      }

      const existingTrail = Array.isArray(period.approvalTrail) ? (period.approvalTrail as any[]) : [];
      const updatedTrail = [
        ...existingTrail,
        {
          stage: 'APPROVED',
          userId: context.userId,
          timestamp: new Date().toISOString(),
          notes: notes?.trim() || 'Approved for financial disbursement and GL posting',
        },
      ];

      const updated = await prisma.payrollPeriod.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: context.userId,
          approvedAt: new Date(),
          approvalTrail: updatedTrail,
        },
      });

      return NextResponse.json({
        success: true,
        status: 'APPROVED',
        approvedBy: context.userId,
        approvedAt: updated.approvedAt,
      });
    }

    // 2. POST_GL_AND_GENERATE_PAYMENT_BATCH (also supports legacy DISBURSE_AND_POST_GL alias)
    if (action === 'POST_GL_AND_GENERATE_PAYMENT_BATCH' || action === 'DISBURSE_AND_POST_GL') {
      const context = await HrAuthorizationService.resolveAuthContext(req);
      HrAuthorizationService.assertPermission(context, 'hr.payroll.release');

      const period = await prisma.payrollPeriod.findFirst({
        where: {
          id,
          organizationId: context.organizationId,
          propertyId: context.propertyId,
        },
        include: {
          property: true,
          payslips: {
            include: { components: true },
          },
        },
      });

      if (!period) {
        return NextResponse.json({ error: 'Payroll batch not found' }, { status: 404 });
      }

      const tenantContext = await requireOrganizationContext(context.userId);

      // Compute aggregated totals for balanced double-entry
      let grossSalaries = 0;
      let netPayable = 0;
      let payeTax = 0;
      let pensionEmployee = 0;
      let pensionEmployer = 0;
      let nhfPayable = 0;
      let nsitfCost = 0;
      let itfCost = 0;
      let loanRecoveries = 0;
      let advanceRecoveries = 0;

      for (const ps of period.payslips) {
        grossSalaries += Number(ps.grossEarnings);
        netPayable += Number(ps.netPay);

        for (const c of ps.components) {
          const amt = Number(c.amount);
          if (c.name.includes('PAYE')) payeTax += amt;
          else if (c.name.includes('Pension Employee')) pensionEmployee += amt;
          else if (c.name.includes('Pension Employer')) pensionEmployer += amt;
          else if (c.name.includes('NHF')) nhfPayable += amt;
          else if (c.name.includes('NSITF')) nsitfCost += amt;
          else if (c.name.includes('ITF')) itfCost += amt;
          else if (c.name.includes('Loan Recovery')) loanRecoveries += amt;
          else if (c.name.includes('Salary Advance Recovery')) advanceRecoveries += amt;
        }
      }

      grossSalaries = Math.round(grossSalaries * 100) / 100;
      netPayable = Math.round(netPayable * 100) / 100;
      payeTax = Math.round(payeTax * 100) / 100;
      pensionEmployee = Math.round(pensionEmployee * 100) / 100;
      pensionEmployer = Math.round(pensionEmployer * 100) / 100;
      nhfPayable = Math.round(nhfPayable * 100) / 100;
      nsitfCost = Math.round(nsitfCost * 100) / 100;
      itfCost = Math.round(itfCost * 100) / 100;
      loanRecoveries = Math.round(loanRecoveries * 100) / 100;
      advanceRecoveries = Math.round(advanceRecoveries * 100) / 100;

      const propertyId = period.propertyId;

      // Ensure GL accounts exist in Chart of Accounts
      // 6010-6030 are already used by legacy operating-supply accounts on
      // live properties. Keep those historical accounts untouched and use a
      // dedicated payroll range for employer statutory expenses.
      const accSalaryExpense = await getOrCreateGlAccount(propertyId, '6000', 'Salaries & Wages Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT');
      const accEmployerPensionExp = await getOrCreateGlAccount(propertyId, '6800', 'Employer Pension Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT');
      const accNsitfExp = await getOrCreateGlAccount(propertyId, '6810', 'NSITF Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT');
      const accItfExp = await getOrCreateGlAccount(propertyId, '6820', 'ITF Expense', 'EXPENSE', 'Payroll Costs', 'DEBIT');

      const accNetSalariesPayable = await getOrCreateGlAccount(propertyId, '2100', 'Net Salaries Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT');
      const accPayePayable = await getOrCreateGlAccount(propertyId, '2110', 'PAYE Tax Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT');
      const accPensionPayable = await getOrCreateGlAccount(propertyId, '2120', 'Pension Contribution Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT');
      const accNhfPayable = await getOrCreateGlAccount(propertyId, '2130', 'NHF Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT');
      const accNsitfPayable = await getOrCreateGlAccount(propertyId, '2140', 'NSITF Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT');
      const accItfPayable = await getOrCreateGlAccount(propertyId, '2150', 'ITF Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT');
      const accLoanRecovery = await getOrCreateGlAccount(propertyId, '1180', 'Employee Staff Loans', 'ASSET', 'Current Assets', 'DEBIT');
      const accAdvanceRecovery = await getOrCreateGlAccount(propertyId, '1185', 'Salary Advances', 'ASSET', 'Current Assets', 'DEBIT');

      const totalPensionContribution = Math.round((pensionEmployee + pensionEmployer) * 100) / 100;

      // Mathematical Double-Entry Construction
      const lines = [
        // DEBITS (Operating Expenses)
        { accountId: accSalaryExpense.id, debit: grossSalaries, credit: 0, description: `${period.name} - Gross Salaries` },
        ...(pensionEmployer > 0 ? [{ accountId: accEmployerPensionExp.id, debit: pensionEmployer, credit: 0, description: 'Employer Pension (10%)' }] : []),
        ...(nsitfCost > 0 ? [{ accountId: accNsitfExp.id, debit: nsitfCost, credit: 0, description: 'NSITF Contribution (1%)' }] : []),
        ...(itfCost > 0 ? [{ accountId: accItfExp.id, debit: itfCost, credit: 0, description: 'ITF Contribution (1%)' }] : []),

        // CREDITS (Liabilities & Asset Recoveries)
        { accountId: accNetSalariesPayable.id, debit: 0, credit: netPayable, description: 'Net Salaries Payable' },
        ...(payeTax > 0 ? [{ accountId: accPayePayable.id, debit: 0, credit: payeTax, description: 'PAYE Withholding Tax Payable' }] : []),
        ...(totalPensionContribution > 0 ? [{ accountId: accPensionPayable.id, debit: 0, credit: totalPensionContribution, description: 'Total Pension (Employee 8% + Employer 10%)' }] : []),
        ...(nhfPayable > 0 ? [{ accountId: accNhfPayable.id, debit: 0, credit: nhfPayable, description: 'NHF Remittance Payable' }] : []),
        ...(nsitfCost > 0 ? [{ accountId: accNsitfPayable.id, debit: 0, credit: nsitfCost, description: 'NSITF Remittance Payable' }] : []),
        ...(itfCost > 0 ? [{ accountId: accItfPayable.id, debit: 0, credit: itfCost, description: 'ITF Remittance Payable' }] : []),
        ...(loanRecoveries > 0 ? [{ accountId: accLoanRecovery.id, debit: 0, credit: loanRecoveries, description: 'Employee Loan Recoveries' }] : []),
        ...(advanceRecoveries > 0 ? [{ accountId: accAdvanceRecovery.id, debit: 0, credit: advanceRecoveries, description: 'Salary Advance Recoveries' }] : []),
      ];

      // Exact mathematical balance reconciliation guard - FAIL CLOSED
      const sumDebits = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
      const sumCredits = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;
      const imbalance = Math.round((sumDebits - sumCredits) * 100) / 100;

      if (Math.abs(imbalance) > 0.001) {
        return NextResponse.json(
          {
            error: `General Ledger reconciliation failure: Debits (₦${sumDebits.toFixed(2)}) do not balance Credits (₦${sumCredits.toFixed(2)}). Discrepancy: ₦${imbalance.toFixed(2)}. Posting rejected to protect financial integrity.`,
            reconciliationDetails: { sumDebits, sumCredits, discrepancy: imbalance },
          },
          { status: 422 }
        );
      }

      // This is an internal payment instruction identifier, not a bank/NIP
      // settlement reference. A real bank reference is recorded only through
      // RECORD_PAYMENT_SETTLEMENT after reconciliation.
      const paymentBatchRef = `PAYROLL-${period.id.slice(0, 8).toUpperCase()}-${Date.now()}`;

      // Atomic execution with database-level concurrency lock
      const journalEntry = await prisma.$transaction(async (tx: any) => {
        // 1. ATOMIC IDEMPOTENCY GUARD: Lock row and prevent concurrent double-posts
        const lockResult = await tx.payrollPeriod.updateMany({
          where: {
            id,
            organizationId: context.organizationId,
            propertyId: context.propertyId,
            status: 'APPROVED',
            journalEntryId: null,
          },
          data: {
            status: 'PROCESSING',
          },
        });

        if (lockResult.count === 0) {
          const check = await tx.payrollPeriod.findUnique({ where: { id } });
          if (check?.journalEntryId) {
            throw new Error(
              `CONCURRENT_CONFLICT: Duplicate posting rejected. Payroll batch is already posted with journalEntryId [${check.journalEntryId}].`
            );
          }
          throw new Error(
            `INVALID_STATE: Cannot post payroll batch in status [${check?.status || 'UNKNOWN'}]. Must be in APPROVED status and unposted.`
          );
        }

        // 2. Post balanced GL Journal
        const entry = await GeneralLedgerService.postJournal(
          tenantContext,
          {
            propertyId,
            entryDate: new Date(),
            description: `Payroll Run Accruals & Payment Batch - ${period.name}`,
            reference: `PAYROLL-${period.id.slice(0, 8).toUpperCase()}`,
            sourceModule: 'AUTO_PAYROLL',
            lines,
          },
          tx
        );

        // 3. Reduce active employee loan balances
        for (const ps of period.payslips) {
          const loanComp = ps.components.find((c: any) => c.name === 'Loan Recovery');
          if (loanComp && Number(loanComp.amount) > 0) {
            const activeLoan = await tx.employeeLoan.findFirst({
              where: { staffId: ps.staffId, propertyId, status: 'ACTIVE' },
              orderBy: { createdAt: 'asc' },
            });
            if (activeLoan) {
              const newBal = Math.max(0, Number(activeLoan.remainingBalance) - Number(loanComp.amount));
              await tx.employeeLoan.update({
                where: { id: activeLoan.id },
                data: {
                  remainingBalance: newBal,
                  status: newBal <= 0 ? 'FULLY_PAID' : 'ACTIVE',
                },
              });
            }
          }

          const advComp = ps.components.find((c: any) => c.name === 'Salary Advance Recovery');
          if (advComp && Number(advComp.amount) > 0) {
            await tx.salaryAdvance.updateMany({
              where: { staffId: ps.staffId, propertyId, status: 'APPROVED' },
              data: { status: 'DEDUCTED' },
            });
          }
        }

        // 4. Update Period status and record journalEntryId
        const existingTrail = Array.isArray(period.approvalTrail) ? (period.approvalTrail as any[]) : [];
        const updatedTrail = [
          ...existingTrail,
          {
            stage: 'POSTED_GL_AND_BATCH_GENERATED',
            userId: context.userId,
            timestamp: new Date().toISOString(),
            journalEntryId: entry.id,
            paymentBatchRef,
            note: 'General Ledger journal posted and internal payment instruction generated; awaiting bank settlement',
          },
        ];

        await tx.payrollPeriod.update({
          where: { id },
          data: {
            status: 'PROCESSING',
            journalEntryId: entry.id,
            paymentBatchRef,
            paymentStatus: 'PROCESSING',
            approvalTrail: updatedTrail,
          },
        });

        // GL posting confirms the payroll calculation, but does not prove bank
        // settlement. Payslips become PAID only after settlement reconciliation.
        await tx.payslip.updateMany({
          where: { payrollPeriodId: id },
          data: { status: 'CONFIRMED' },
        });

        return entry;
      });

      let autoPayment: { enabled: boolean; initiated: number; failed: number } = { enabled: false, initiated: 0, failed: 0 };
      try {
        autoPayment = await initiateFlutterwavePayroll(id, context.organizationId, propertyId);
      } catch (error) {
        console.error('Flutterwave payroll initiation failed after GL commit:', error);
        autoPayment = { enabled: true, initiated: 0, failed: period.payslips.length };
      }

      return NextResponse.json({
        success: true,
        message: autoPayment.enabled ? 'Payroll posted and Flutterwave payout initiation completed; final settlement remains provider-confirmed.' : 'Payroll accruals posted to General Ledger. Configure Flutterwave payroll payouts to automate bank settlement.',
        journalEntryId: journalEntry.id,
        paymentBatchRef,
        paymentStatus: 'PROCESSING',
        autoPayment,
      });
    }

    // 3. RECORD_PAYMENT_SETTLEMENT: Confirms manual bank transfer or bank statement reconciliation
    if (action === 'RECORD_PAYMENT_SETTLEMENT') {
      const context = await HrAuthorizationService.resolveAuthContext(req);
      HrAuthorizationService.assertPermission(context, 'hr.payroll.release');

      const { settlementRef, settlementDate, notes } = body;
      if (!settlementRef) {
        return NextResponse.json({ error: 'Bank settlement reference is required' }, { status: 400 });
      }

      const period = await prisma.payrollPeriod.findFirst({
        where: { id, organizationId: context.organizationId, propertyId: context.propertyId },
      });

      if (!period) return NextResponse.json({ error: 'Payroll batch not found' }, { status: 404 });
      if (!['PROCESSING', 'PAID'].includes(period.status)) {
        return NextResponse.json(
          { error: `Cannot record payment settlement for batch in status [${period.status}]. The batch must be posted to the GL and awaiting settlement.` },
          { status: 400 }
        );
      }
      if (period.paymentStatus === 'SETTLED') {
        return NextResponse.json({
          success: true,
          message: 'Bank payment settlement was already recorded.',
          paymentStatus: 'SETTLED',
          settlementRef,
        });
      }

      const payoutStatuses = await prisma.payrollPayout.findMany({
        where: { payrollPeriodId: id },
        select: { status: true },
      });
      if (payoutStatuses.some((payout) => ['QUEUED', 'PROCESSING', 'SUCCESSFUL'].includes(payout.status))) {
        return NextResponse.json(
          { error: 'Provider payroll payouts are still active. Reconcile the provider payouts before recording a manual bank settlement.' },
          { status: 409 }
        );
      }

      const existingTrail = Array.isArray(period.approvalTrail) ? (period.approvalTrail as any[]) : [];
      const updatedTrail = [
        ...existingTrail,
        {
          stage: 'BANK_PAYMENT_SETTLED',
          userId: context.userId,
          timestamp: new Date().toISOString(),
          settlementRef: String(settlementRef).trim(),
          settlementDate: settlementDate || new Date().toISOString(),
          notes: notes?.trim() || 'Bank disbursement confirmed and reconciled against bank statement',
        },
      ];

      await prisma.$transaction(async (tx: any) => {
        await tx.payrollPeriod.update({
          where: { id, organizationId: context.organizationId, propertyId: context.propertyId },
          data: {
            paymentStatus: 'SETTLED',
            paymentDate: settlementDate ? new Date(settlementDate) : new Date(),
            approvalTrail: updatedTrail,
          },
        });
        await tx.payslip.updateMany({ where: { payrollPeriodId: id }, data: { status: 'PAID' } });
        await tx.referralCommission.updateMany({ where: { payslip: { payrollPeriodId: id }, payslipId: { not: null }, status: 'APPROVED' }, data: { status: 'PAID', paidAt: settlementDate ? new Date(settlementDate) : new Date() } });
      });

      const paidStaffCommissions = await prisma.referralCommission.findMany({ where: { payslip: { payrollPeriodId: id }, status: 'PAID', partner: { isStaffReferrer: true, staffId: { not: null } } }, select: { id: true, amount: true, currency: true, organizationId: true, propertyId: true, partner: { select: { staffId: true } }, payslip: { select: { payrollPeriod: { select: { name: true } } } } } });
      await Promise.all(paidStaffCommissions.map(async (commission) => {
        if (!commission.partner.staffId) return;
        try {
          await notifyEmployee({ organizationId: commission.organizationId, propertyId: commission.propertyId, staffId: commission.partner.staffId, subject: 'Referral commission added to payslip', body: `${Number(commission.amount).toLocaleString()} ${commission.currency} referral commission has been added to your ${commission.payslip?.payrollPeriod.name || 'payroll'} payslip.`, category: 'PAYROLL', action: '/hr/self-service', idempotencyKey: `referral-payslip:${commission.id}` });
        } catch (error) {
          console.error('Failed to notify staff referral payroll settlement', { commissionId: commission.id, error });
        }
      }));

      return NextResponse.json({
        success: true,
        message: 'Bank payment settlement recorded and reconciled successfully.',
        paymentStatus: 'SETTLED',
        settlementRef,
      });
    }

    return NextResponse.json({ error: 'Invalid payroll action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('CONCURRENT_CONFLICT')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message?.includes('INVALID_STATE')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Payroll action error:', error);
    return NextResponse.json({ error: error.message || 'Failed to complete payroll action' }, { status: 500 });
  }
}
