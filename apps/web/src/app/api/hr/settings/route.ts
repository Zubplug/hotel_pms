import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    // Viewing settings requires hr.settings.manage or hr.employee.view
    if (!HrAuthorizationService.can(authContext, 'hr.settings.manage') && !HrAuthorizationService.can(authContext, 'hr.employee.view')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const organizationId = authContext.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const payrollAccount = await prisma.bookingPaymentAccount.findFirst({
      where: { organizationId, propertyId: authContext.propertyId, provider: 'FLUTTERWAVE', mode: 'CUSTOMER', isActive: true },
      select: { payrollEnabled: true, secretCiphertext: true, webhookSecretCiphertext: true },
    });

    const activeConfig = await prisma.statutoryConfiguration.findFirst({
      where: {
        organizationId,
        isActive: true,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    const penaltyPolicies = authContext.propertyId
      ? await prisma.attendancePenaltyPolicy.findMany({ where: { organizationId, propertyId: authContext.propertyId }, orderBy: [{ isActive: 'desc' }, { effectiveFrom: 'desc' }, { name: 'asc' }] })
      : [];
    const formattedPenaltyPolicies = penaltyPolicies.map((policy) => ({ ...policy, amount: Number(policy.amount), maximumAmount: policy.maximumAmount === null ? null : Number(policy.maximumAmount) }));

    if (!activeConfig) {
      // Return defaults if none configured yet
      return NextResponse.json({
        payment: { configured: Boolean(payrollAccount?.secretCiphertext && payrollAccount.webhookSecretCiphertext), autoPaymentEnabled: Boolean(payrollAccount?.payrollEnabled && payrollAccount?.secretCiphertext && payrollAccount?.webhookSecretCiphertext) },
        penaltyPolicies: formattedPenaltyPolicies,
        config: {
          versionTag: 'PITA_2020_CURRENT',
          taxRegime: 'PITA_2011',
          pensionEnabled: true,
          pensionExemptionReason: null,
          nhfEnabled: true,
          nhfExemptionReason: null,
          effectiveFrom: new Date().toISOString(),
          pensionEmployeeRate: 0.08,
          pensionEmployerRate: 0.10,
          nhfRate: 0.025,
          nsitfRate: 0.01,
          itfRate: 0.01,
          minimumWageFloor: 70000,
          craFixedFloor: 200000,
          craPercentOne: 1.0,
          craPercentTwo: 20.0,
          craBaseAmount: 200000,
          craPercentGross: 0.20,
          craHigherPercent: 0.01,
          standardWorkWeekHours: 40,
          overtimeRateMultiplier: 1.5,
          holidayOvertimeMultiplier: 2.0,
          glSalaryExpense: '6000',
          glEmployerPensionExpense: '6010',
          glNetSalariesPayable: '2100',
          glPayePayable: '2110',
          glPensionPayable: '2120',
        },
      });
    }

    return NextResponse.json({
      payment: { configured: Boolean(payrollAccount?.secretCiphertext && payrollAccount.webhookSecretCiphertext), autoPaymentEnabled: Boolean(payrollAccount?.payrollEnabled && payrollAccount?.secretCiphertext && payrollAccount?.webhookSecretCiphertext) },
      penaltyPolicies: formattedPenaltyPolicies,
      config: {
        ...activeConfig,
        taxRegime: activeConfig.taxRegime,
        pensionEnabled: activeConfig.pensionEnabled,
        pensionExemptionReason: activeConfig.pensionExemptionReason,
        nhfEnabled: activeConfig.nhfEnabled,
        nhfExemptionReason: activeConfig.nhfExemptionReason,
        pensionEmployeeRate: Number(activeConfig.pensionEmployeeRate) * 100,
        pensionEmployerRate: Number(activeConfig.pensionEmployerRate) * 100,
        nhfRate: Number(activeConfig.nhfRate) * 100,
        nsitfRate: Number(activeConfig.nsitfRate) * 100,
        itfRate: Number(activeConfig.itfRate) * 100,
        craFixedFloor: Number(activeConfig.craBaseAmount),
        craPercentTwo: Number(activeConfig.craPercentGross) * 100,
        craPercentOne: Number(activeConfig.craHigherPercent) * 100,
        minimumWageFloor: Number(activeConfig.minimumWageFloor),
        standardWorkWeekHours: Number(activeConfig.standardWorkWeekHours),
        overtimeRateMultiplier: Number(activeConfig.overtimeRateMultiplier),
        holidayOvertimeMultiplier: Number(activeConfig.holidayOvertimeMultiplier),
        gracePeriodMins: activeConfig.gracePeriodMinutes,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to load HR settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve statutory configuration' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.settings.manage');

    const organizationId = authContext.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const body = await req.json();
    if (body.action === 'SET_AUTO_PAYMENT') {
      const enabled = Boolean(body.enabled);
      const account = await prisma.bookingPaymentAccount.findFirst({ where: { organizationId, propertyId: authContext.propertyId, provider: 'FLUTTERWAVE', mode: 'CUSTOMER', isActive: true }, select: { id: true, secretCiphertext: true, webhookSecretCiphertext: true } });
      if (!account?.secretCiphertext || !account.webhookSecretCiphertext) return NextResponse.json({ error: 'Configure Flutterwave credentials in /portal/integrations first' }, { status: 409 });
      await prisma.bookingPaymentAccount.update({ where: { id: account.id }, data: { payrollEnabled: enabled } });
      return NextResponse.json({ success: true, autoPaymentEnabled: enabled });
    }
    if (body.action === 'SAVE_PENALTY_POLICY') {
      if (!authContext.propertyId) return NextResponse.json({ error: 'Property context required' }, { status: 400 });
      const { id, code, name, trigger, calculationType, amount, graceMinutes = 0, maximumAmount, requiresApproval = true, effectiveFrom, effectiveTo, isActive = true } = body;
      const normalizedCode = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const allowedTriggers = ['LATE_ARRIVAL', 'EARLY_DEPARTURE', 'ABSENCE', 'MISSED_PUNCH'];
      const allowedCalculations = ['FIXED_AMOUNT', 'PER_MINUTE', 'PERCENT_BASIC'];
      const parsedAmount = Number(amount);
      const parsedGrace = Number(graceMinutes);
      const start = new Date(`${effectiveFrom}T00:00:00.000Z`);
      const end = effectiveTo ? new Date(`${effectiveTo}T00:00:00.000Z`) : null;
      if (!normalizedCode || !String(name || '').trim() || !allowedTriggers.includes(trigger) || !allowedCalculations.includes(calculationType) || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isInteger(parsedGrace) || parsedGrace < 0 || Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime())) || (end && end < start)) {
        return NextResponse.json({ error: 'Provide valid policy details, amount, trigger, calculation, and effective dates' }, { status: 400 });
      }
      const duplicate = await prisma.attendancePenaltyPolicy.findFirst({ where: { propertyId: authContext.propertyId, code: normalizedCode, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: `A penalty policy with code ${normalizedCode} already exists` }, { status: 409 });
      const data = { organizationId, propertyId: authContext.propertyId, code: normalizedCode, name: String(name).trim(), trigger, calculationType, amount: parsedAmount, graceMinutes: parsedGrace, maximumAmount: maximumAmount === '' || maximumAmount === null || maximumAmount === undefined ? null : Number(maximumAmount), requiresApproval: Boolean(requiresApproval), effectiveFrom: start, effectiveTo: end, isActive: Boolean(isActive), createdById: authContext.userId };
      const policy = id
        ? await prisma.attendancePenaltyPolicy.update({ where: { id }, data: { ...data, organizationId, propertyId: authContext.propertyId } })
        : await prisma.attendancePenaltyPolicy.create({ data });
      return NextResponse.json({ success: true, policy: { ...policy, amount: Number(policy.amount), maximumAmount: policy.maximumAmount === null ? null : Number(policy.maximumAmount) } }, { status: id ? 200 : 201 });
    }
    const {
      versionTag = `CONFIG_${new Date().getFullYear()}_${Date.now().toString().slice(-4)}`,
      taxRegime = 'PITA_2011',
      pensionEnabled = true,
      pensionExemptionReason = null,
      nhfEnabled = true,
      nhfExemptionReason = null,
      pensionEmployeeRate = 8.0,
      pensionEmployerRate = 10.0,
      nhfRate = 2.5,
      nsitfRate = 1.0,
      itfRate = 1.0,
      craFixedFloor = 200000,
      craPercentOne = 1.0,
      craPercentTwo = 20.0,
      minimumWageFloor = 70000,
      effectiveFrom,
      taxBands,
      standardWorkWeekHours = 40,
      overtimeRateMultiplier = 1.5,
      holidayOvertimeMultiplier = 2,
      gracePeriodMins = 15,
      glSalaryExpense = '6000',
      glEmployerPensionExpense = '6010',
      glNetSalariesPayable = '2100',
      glPayePayable = '2110',
      glPensionPayable = '2120',
    } = body;

    const effectiveFromDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

    if (Number.isNaN(effectiveFromDate.getTime())) {
      return NextResponse.json({ error: 'Invalid statutory effective date' }, { status: 400 });
    }

    if (!['PITA_2011', 'NTA_2026'].includes(String(taxRegime))) {
      return NextResponse.json({ error: 'Tax regime must be PITA_2011 or NTA_2026' }, { status: 400 });
    }
    if (!pensionEnabled && String(pensionExemptionReason || '').trim().length < 5) {
      return NextResponse.json({ error: 'Provide a documented reason when pension contributions are disabled' }, { status: 400 });
    }
    if (!nhfEnabled && String(nhfExemptionReason || '').trim().length < 5) {
      return NextResponse.json({ error: 'Provide a documented reason when NHF contributions are disabled' }, { status: 400 });
    }

    // 1. Preserve true statutory history: Cap previous open-ended configs with effectiveTo
    // 2. Normalize tax bands so both cap and threshold are defined and compatible with the calculation engine
    const rawBands = taxBands || (taxRegime === 'NTA_2026' ? [
      { cap: 800000, threshold: 800000, rate: 0 },
      { cap: 2200000, threshold: 2200000, rate: 0.15 },
      { cap: 9000000, threshold: 9000000, rate: 0.18 },
      { cap: 13000000, threshold: 13000000, rate: 0.21 },
      { cap: 25000000, threshold: 25000000, rate: 0.23 },
      { cap: null, threshold: null, rate: 0.25 },
    ] : [
      { cap: 300000, threshold: 300000, rate: 0.07 },
      { cap: 300000, threshold: 300000, rate: 0.11 },
      { cap: 500000, threshold: 500000, rate: 0.15 },
      { cap: 500000, threshold: 500000, rate: 0.19 },
      { cap: 1600000, threshold: 1600000, rate: 0.21 },
      { cap: null, threshold: null, rate: 0.24 },
    ]);

    const normalizedTaxBands = rawBands.map((b: any) => {
      const capValue = b.cap !== undefined && b.cap !== null
        ? Number(b.cap)
        : (b.threshold !== undefined && b.threshold !== null ? Number(b.threshold) : null);
      return {
        cap: capValue,
        threshold: capValue,
        rate: Number(b.rate),
      };
    });

    if (!Number.isFinite(Number(minimumWageFloor)) || Number(minimumWageFloor) < 0) {
      return NextResponse.json({ error: 'Minimum wage floor must be a non-negative number' }, { status: 400 });
    }
    if (![standardWorkWeekHours, overtimeRateMultiplier, holidayOvertimeMultiplier, gracePeriodMins].every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) {
      return NextResponse.json({ error: 'Operational settings must be non-negative numbers' }, { status: 400 });
    }

    const newConfig = await prisma.$transaction(async (tx) => {
      const overlap = await tx.statutoryConfiguration.findFirst({
        where: {
          organizationId,
          effectiveFrom: { equals: effectiveFromDate },
        },
        select: { id: true },
      });
      if (overlap) throw new Error('CONFLICT: A statutory configuration already exists for this effective date');

      await tx.statutoryConfiguration.updateMany({
        where: { organizationId, effectiveTo: null, effectiveFrom: { lt: effectiveFromDate } },
        data: { effectiveTo: effectiveFromDate },
      });

      return tx.statutoryConfiguration.create({
        data: {
          organizationId,
          versionTag: String(versionTag),
          taxRegime: String(taxRegime),
          effectiveFrom: effectiveFromDate,
          minimumWageFloor: Number(minimumWageFloor),
          pensionEmployeeRate: Number(pensionEmployeeRate) / 100,
          pensionEmployerRate: Number(pensionEmployerRate) / 100,
          pensionEnabled: Boolean(pensionEnabled),
          pensionExemptionReason: pensionEnabled ? null : String(pensionExemptionReason || '').trim() || null,
          nhfRate: Number(nhfRate) / 100,
          nhfEnabled: Boolean(nhfEnabled),
          nhfExemptionReason: nhfEnabled ? null : String(nhfExemptionReason || '').trim() || null,
          nsitfRate: Number(nsitfRate) / 100,
          itfRate: Number(itfRate) / 100,
          craBaseAmount: Number(craFixedFloor),
          craPercentGross: Number(craPercentTwo) / 100,
          craHigherPercent: Number(craPercentOne) / 100,
          standardWorkWeekHours: Number(standardWorkWeekHours),
          overtimeRateMultiplier: Number(overtimeRateMultiplier),
          holidayOvertimeMultiplier: Number(holidayOvertimeMultiplier),
          gracePeriodMinutes: Math.round(Number(gracePeriodMins)),
          glSalaryExpense: String(glSalaryExpense).trim(),
          glEmployerPensionExpense: String(glEmployerPensionExpense).trim(),
          glNetSalariesPayable: String(glNetSalariesPayable).trim(),
          glPayePayable: String(glPayePayable).trim(),
          glPensionPayable: String(glPensionPayable).trim(),
          taxBands: normalizedTaxBands,
          isActive: true,
          createdById: authContext.userId,
        },
      });
    });

    return NextResponse.json({ success: true, config: newConfig }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    if (error.message?.includes('CONFLICT')) {
      return NextResponse.json({ error: error.message.replace('CONFLICT: ', '') }, { status: 409 });
    }
    console.error('Failed to update HR settings:', error);
    return NextResponse.json({ error: 'Failed to persist statutory configuration' }, { status: 500 });
  }
}
