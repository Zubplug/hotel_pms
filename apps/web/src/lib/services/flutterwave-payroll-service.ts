import {
  createFlutterwaveTransfer,
  decrypt,
  getFlutterwaveBanks,
  getFlutterwaveTransfer,
  resolveFlutterwaveBankAccount,
  encrypt,
  prisma,
} from '@hotel-pms/db';
import { decryptPaymentCredential } from '@/lib/payment-providers/credentials';
import { notifyEmployee } from '@/lib/employee-notification-service';

export const FLUTTERWAVE_PAYROLL_SLUG = 'FLUTTERWAVE_PAYROLL_PAYOUT';

type Credentials = { secretKey: string; webhookSecretHash: string; environment: 'TEST' | 'LIVE' };

function readCredentials(value: string | null): Credentials {
  if (!value) throw new Error('Flutterwave payroll credentials are not configured');
  const parsed = JSON.parse(decrypt(JSON.parse(value))) as Credentials;
  if (!parsed.secretKey || !parsed.webhookSecretHash) throw new Error('Flutterwave payroll credentials are incomplete');
  return parsed;
}

async function definition() {
  const existing = await prisma.integrationDefinition.findUnique({ where: { slug: FLUTTERWAVE_PAYROLL_SLUG } });
  if (existing) return existing;
  try {
    return await prisma.integrationDefinition.create({ data: {
      slug: FLUTTERWAVE_PAYROLL_SLUG,
      name: 'Flutterwave Payroll Payouts',
      category: 'PAYMENTS',
      description: 'Tenant-scoped payroll salary transfers through Flutterwave.',
      active: true,
    } });
  } catch (error: any) {
    if (error?.code === 'P2002') return prisma.integrationDefinition.findUniqueOrThrow({ where: { slug: FLUTTERWAVE_PAYROLL_SLUG } });
    throw error;
  }
}

export async function saveFlutterwavePayrollIntegration(input: {
  organizationId: string; propertyId: string; credentials: Credentials; enabled: boolean;
}) {
  const def = await definition();
  const property = await prisma.property.findFirst({ where: { id: input.propertyId, organizationId: input.organizationId } });
  if (!property) throw new Error('Property is outside the organization');
  const encrypted = encrypt(JSON.stringify(input.credentials));
  return prisma.installedIntegration.upsert({
    where: { organizationId_definitionId_propertyId: { organizationId: input.organizationId, definitionId: def.id, propertyId: input.propertyId } },
    update: { status: input.enabled ? 'ACTIVE' : 'DISABLED', credentialsRef: JSON.stringify(encrypted), config: { environment: input.credentials.environment } },
    create: { organizationId: input.organizationId, definitionId: def.id, propertyId: input.propertyId, status: input.enabled ? 'ACTIVE' : 'DISABLED', credentialsRef: JSON.stringify(encrypted), config: { environment: input.credentials.environment } },
  });
}

export async function getFlutterwavePayrollIntegration(organizationId: string, propertyId: string) {
  const account = await prisma.bookingPaymentAccount.findFirst({
    where: { organizationId, propertyId, provider: 'FLUTTERWAVE', mode: 'CUSTOMER', target: 'PAYROLL', isActive: true },
    select: { target: true, payrollEnabled: true, secretCiphertext: true, webhookSecretCiphertext: true },
  }) ?? await prisma.bookingPaymentAccount.findFirst({
    where: { organizationId, propertyId, provider: 'FLUTTERWAVE', mode: 'CUSTOMER', isActive: true },
    select: { target: true, payrollEnabled: true, secretCiphertext: true, webhookSecretCiphertext: true },
  });
  if (account) {
    if (!account.payrollEnabled || !account.secretCiphertext || !account.webhookSecretCiphertext) return null;
    return { row: null, credentials: { secretKey: decryptPaymentCredential(account.secretCiphertext), webhookSecretHash: decryptPaymentCredential(account.webhookSecretCiphertext), environment: 'LIVE' as const } };
  }

  const row = await prisma.installedIntegration.findFirst({
    where: { organizationId, propertyId, status: 'ACTIVE', definition: { slug: FLUTTERWAVE_PAYROLL_SLUG } },
  });
  if (row) return { row, credentials: readCredentials(row.credentialsRef) };

  // The customer portal stores provider credentials in the canonical
  // BookingPaymentAccount. Reuse it so payroll does not create a second
  // credential store for the same Flutterwave merchant account.
  return null;
}

export async function getPayrollPaymentEligibility(organizationId: string, propertyId: string) {
  const [booking, publishedWebsite, customWebsite] = await Promise.all([
    prisma.bookingEngineConfig.findFirst({ where: { organizationId, propertyId, enabled: true }, select: { id: true } }),
    prisma.websiteProject.findFirst({ where: { organizationId, propertyId, status: 'PUBLISHED' }, select: { id: true } }),
    prisma.customWebsiteRequest.findFirst({ where: { organizationId, propertyId, developmentMode: { in: ['STANDALONE_API', 'PMS_CONNECTED'] }, status: { in: ['PAID', 'IN_PROGRESS', 'DELIVERED'] } }, select: { id: true, developmentMode: true } }),
  ]);
  return { eligible: Boolean(booking || publishedWebsite || customWebsite), sources: { bookingEngine: Boolean(booking), publishedWebsite: Boolean(publishedWebsite), customWebsite: customWebsite?.developmentMode ?? null } };
}

export async function testFlutterwavePayrollCredentials(credentials: Credentials) {
  await getFlutterwaveBanks(credentials.secretKey);
  return true;
}

export async function listPayrollBanks(organizationId: string, propertyId: string) {
  const integration = await getFlutterwavePayrollIntegration(organizationId, propertyId);
  if (!integration) throw new Error('Configure and enable Flutterwave payroll first');
  return getFlutterwaveBanks(integration.credentials.secretKey);
}

export async function verifyPayrollBankAccount(organizationId: string, propertyId: string, accountNumber: string, bankCode: string) {
  const integration = await getFlutterwavePayrollIntegration(organizationId, propertyId);
  if (!integration) throw new Error('Enable Flutterwave payroll payouts before verifying bank accounts');
  const account = accountNumber.replace(/\D/g, '');
  const bank = bankCode.trim();
  if (!/^\d{10}$/.test(account) || !/^\d{3,6}$/.test(bank)) throw new Error('A valid Nigerian 10-digit account number and bank code are required');
  const result = await resolveFlutterwaveBankAccount({ secretKey: integration.credentials.secretKey, accountNumber: account, bankCode: bank });
  return { accountNumber: result.account_number, accountName: result.account_name, verifiedAt: new Date().toISOString(), verificationReference: `FLW-${account.slice(-4)}-${Date.now()}` };
}

export async function initiateFlutterwavePayroll(periodId: string, organizationId: string, propertyId: string) {
  const integration = await getFlutterwavePayrollIntegration(organizationId, propertyId);
  if (!integration) return { enabled: false, initiated: 0, failed: 0 };
  const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, organizationId, propertyId }, include: { payslips: { include: { staff: true } } } });
  if (!period) throw new Error('Payroll period not found');
  let initiated = 0; let failed = 0;
  for (const payslip of period.payslips) {
    if (Number(payslip.netPay) <= 0) continue;
    if (!payslip.accountNumber || !payslip.bankSortCode) { failed++; continue; }
    const reference = `LC-${period.id.slice(0, 8)}-${payslip.id.slice(0, 8)}`;
    const existing = await prisma.payrollPayout.findUnique({ where: { payslipId: payslip.id } });
    if (existing?.status === 'SUCCESSFUL' || existing?.status === 'PROCESSING') continue;
    const payout = existing ?? await prisma.payrollPayout.create({ data: { organizationId, propertyId, payrollPeriodId: period.id, payslipId: payslip.id, staffId: payslip.staffId, providerReference: reference, amount: payslip.netPay, currency: payslip.currency, status: 'QUEUED' } });
    try {
      const verified = await resolveFlutterwaveBankAccount({ secretKey: integration.credentials.secretKey, accountNumber: payslip.accountNumber, bankCode: payslip.bankSortCode });
      const transfer = await createFlutterwaveTransfer({ secretKey: integration.credentials.secretKey, amount: Number(payslip.netPay), currency: payslip.currency, bankCode: payslip.bankSortCode, accountNumber: payslip.accountNumber, beneficiaryName: verified.account_name, reference, narration: `LodgeCore payroll ${period.name}`, meta: { payrollPeriodId: period.id, payslipId: payslip.id, payoutId: payout.id } });
      await prisma.payrollPayout.update({ where: { id: payout.id }, data: { providerTransferId: String(transfer.id), providerStatus: transfer.status, status: ['SUCCESSFUL', 'COMPLETED'].includes(transfer.status) ? 'SUCCESSFUL' : 'PROCESSING', initiatedAt: new Date(), rawResponse: { id: transfer.id, status: transfer.status, reference: transfer.reference, amount: transfer.amount, currency: transfer.currency } } });
      initiated++;
    } catch (error) {
      failed++;
      await prisma.payrollPayout.update({ where: { id: payout.id }, data: { status: 'FAILED', failureReason: error instanceof Error ? error.message.slice(0, 500) : 'Flutterwave transfer failed' } });
    }
  }
  await prisma.payrollPeriod.update({ where: { id: period.id }, data: { paymentStatus: failed ? (initiated ? 'PARTIAL' : 'FAILED') : 'PROCESSING' } });
  return { enabled: true, initiated, failed };
}

export async function reconcileFlutterwavePayout(payoutId: string) {
  const payout = await prisma.payrollPayout.findUnique({ where: { id: payoutId } });
  if (!payout?.providerTransferId) throw new Error('Flutterwave transfer is not available for reconciliation');
  const integration = await getFlutterwavePayrollIntegration(payout.organizationId, payout.propertyId);
  if (!integration) throw new Error('Flutterwave integration is disabled');
  const transfer = await getFlutterwaveTransfer(integration.credentials.secretKey, payout.providerTransferId);
  const status = ['SUCCESSFUL', 'COMPLETED'].includes(transfer.status) ? 'SUCCESSFUL' : ['FAILED', 'CANCELLED'].includes(transfer.status) ? 'FAILED' : 'PROCESSING';
  const updated = await prisma.payrollPayout.update({ where: { id: payout.id }, data: { providerStatus: transfer.status, status, completedAt: status === 'SUCCESSFUL' || status === 'FAILED' ? new Date() : undefined, rawResponse: { id: transfer.id, status: transfer.status, reference: transfer.reference, amount: transfer.amount, currency: transfer.currency } } });
  await settlePeriodIfComplete(payout.payrollPeriodId);
  return updated;
}

export async function settlePeriodIfComplete(payrollPeriodId: string) {
  const [period, payouts] = await Promise.all([
    prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId }, select: { id: true, status: true, paymentStatus: true } }),
    prisma.payrollPayout.findMany({ where: { payrollPeriodId }, select: { status: true } }),
  ]);
  if (!period || period.status !== 'PROCESSING' || !payouts.length) return;
  if (payouts.every(payout => payout.status === 'SUCCESSFUL')) {
    const settledAt = new Date();
    await prisma.$transaction([
      prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { paymentStatus: 'SETTLED', paymentDate: settledAt, status: 'PAID' } }),
      prisma.payslip.updateMany({ where: { payrollPeriodId }, data: { status: 'PAID' } }),
      prisma.referralCommission.updateMany({ where: { payslip: { payrollPeriodId }, payslipId: { not: null }, status: 'APPROVED' }, data: { status: 'PAID', paidAt: settledAt } }),
    ]);
    const commissions = await prisma.referralCommission.findMany({ where: { payslip: { payrollPeriodId }, status: 'PAID', partner: { isStaffReferrer: true, staffId: { not: null } } }, select: { id: true, amount: true, currency: true, organizationId: true, propertyId: true, partner: { select: { staffId: true } }, payslip: { select: { payrollPeriod: { select: { name: true } } } } } });
    await Promise.all(commissions.map(async (commission) => {
      if (!commission.partner.staffId) return;
      try {
        await notifyEmployee({ organizationId: commission.organizationId, propertyId: commission.propertyId, staffId: commission.partner.staffId, subject: 'Referral commission added to payslip', body: `${Number(commission.amount).toLocaleString()} ${commission.currency} referral commission has been added to your ${commission.payslip?.payrollPeriod.name || 'payroll'} payslip.`, category: 'PAYROLL', action: '/hr/self-service', idempotencyKey: `referral-payslip:${commission.id}` });
      } catch (error) {
        console.error('Failed to notify staff referral payroll settlement', { commissionId: commission.id, error });
      }
    }));
  } else if (payouts.some(payout => payout.status === 'FAILED')) {
    await prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { paymentStatus: 'PARTIAL' } });
  }
}
