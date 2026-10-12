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

    if (!activeConfig) {
      // Return defaults if none configured yet
      return NextResponse.json({
        payment: { configured: Boolean(payrollAccount?.secretCiphertext && payrollAccount.webhookSecretCiphertext), autoPaymentEnabled: Boolean(payrollAccount?.payrollEnabled && payrollAccount?.secretCiphertext && payrollAccount?.webhookSecretCiphertext) },
        config: {
          versionTag: 'PITA_2020_CURRENT',
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
      config: {
        ...activeConfig,
        pensionEmployeeRate: Number(activeConfig.pensionEmployeeRate) * 100,
        pensionEmployerRate: Number(activeConfig.pensionEmployerRate) * 100,
        nhfRate: Number(activeConfig.nhfRate) * 100,
        nsitfRate: Number(activeConfig.nsitfRate) * 100,
        itfRate: Number(activeConfig.itfRate) * 100,
        craFixedFloor: Number(activeConfig.craBaseAmount),
        craPercentTwo: Number(activeConfig.craPercentGross) * 100,
        craPercentOne: Number(activeConfig.craHigherPercent) * 100,
        minimumWageFloor: Number(activeConfig.minimumWageFloor),
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
    const {
      versionTag = `CONFIG_${new Date().getFullYear()}_${Date.now().toString().slice(-4)}`,
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
    } = body;

    const effectiveFromDate = effectiveFrom ? new Date(effectiveFrom) : new Date();

    if (Number.isNaN(effectiveFromDate.getTime())) {
      return NextResponse.json({ error: 'Invalid statutory effective date' }, { status: 400 });
    }

    // 1. Preserve true statutory history: Cap previous open-ended configs with effectiveTo
    // 2. Normalize tax bands so both cap and threshold are defined and compatible with the calculation engine
    const rawBands = taxBands || [
      { cap: 300000, threshold: 300000, rate: 0.07 },
      { cap: 300000, threshold: 300000, rate: 0.11 },
      { cap: 500000, threshold: 500000, rate: 0.15 },
      { cap: 500000, threshold: 500000, rate: 0.19 },
      { cap: 1600000, threshold: 1600000, rate: 0.21 },
      { cap: null, threshold: null, rate: 0.24 },
    ];

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
          effectiveFrom: effectiveFromDate,
          minimumWageFloor: Number(minimumWageFloor),
          pensionEmployeeRate: Number(pensionEmployeeRate) / 100,
          pensionEmployerRate: Number(pensionEmployerRate) / 100,
          nhfRate: Number(nhfRate) / 100,
          nsitfRate: Number(nsitfRate) / 100,
          itfRate: Number(itfRate) / 100,
          craBaseAmount: Number(craFixedFloor),
          craPercentGross: Number(craPercentTwo) / 100,
          craHigherPercent: Number(craPercentOne) / 100,
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
