import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { refreshReachPropertyDebt, settleReachWallet } from '@hotel-pms/db';
import { createHash } from 'crypto';

type ReachTx = any;

const DEFAULT_CODES = {
  commissionPayable: '2205',
  commissionExpense: '5200',
} as const;

const HQ_CODES = {
  platformFeeReceivable: '1205',
  platformFeeRevenue: '4450',
  walletClearing: '1015',
  walletLiability: '2305',
} as const;

async function resolveReachAccounts(tx: ReachTx, propertyId: string) {
  const property = await tx.property.findUnique({ where: { id: propertyId }, select: { organizationId: true, settings: true } });
  if (!property) throw new Error('Reach accounting property not found');
  const configured = ((property.settings as any)?.accountingConfig?.reachAccounts || {}) as Record<string, string>;
  const codes = {
    commissionPayable: configured.COMMISSION_PAYABLE || DEFAULT_CODES.commissionPayable,
    commissionExpense: configured.COMMISSION_EXPENSE || DEFAULT_CODES.commissionExpense,
  };
  const entries = await Promise.all(Object.entries(codes).map(async ([key, code]) => {
    const account = await tx.chartOfAccount.findFirst({ where: { propertyId, code, isActive: true } });
    if (!account) throw new Error(`Reach GL account ${code} (${key}) is missing or inactive for property ${propertyId}`);
    return [key, account.id] as const;
  }));
  return { organizationId: property.organizationId, accounts: Object.fromEntries(entries) as Record<string, string> };
}

async function resolveHqAccounts(tx: ReachTx) {
  const entries = await Promise.all(Object.entries(HQ_CODES).map(async ([key, code]) => {
    const account = await tx.hqChartOfAccount.findUnique({ where: { code } });
    if (!account || !account.isActive) throw new Error(`HQ Reach GL account ${code} (${key}) is missing or inactive`);
    return [key, account.id] as const;
  }));
  return Object.fromEntries(entries) as Record<string, string>;
}

export async function postHqWalletSettlementJournal(input: { tx: ReachTx; transactionId: string; amount: number; actorId: string; entryDate: Date }) {
  const accounts = await resolveHqAccounts(input.tx);
  const existing = await input.tx.hqJournalEntryLine.findFirst({ where: { sourceType: 'REACH_WALLET_SETTLEMENT', sourceId: input.transactionId }, select: { entryId: true } });
  if (existing) return input.tx.hqJournalEntry.findUnique({ where: { id: existing.entryId } });
  return input.tx.hqJournalEntry.create({
    data: {
      entryNumber: `HQ-JE-${Date.now()}-${input.transactionId.slice(0, 8)}`,
      entryDate: input.entryDate,
      description: 'Reach platform fee settled from customer wallet',
      reference: `REACH-WALLET:${input.transactionId}`,
      source: 'REACH', status: 'POSTED', totalDebit: input.amount, totalCredit: input.amount, createdBy: input.actorId,
      lines: { create: [
        { accountId: accounts.walletLiability, debit: input.amount, credit: 0, description: 'Reduce customer Reach wallet liability', sourceType: 'REACH_WALLET_SETTLEMENT', sourceId: input.transactionId },
        { accountId: accounts.platformFeeReceivable, debit: 0, credit: input.amount, description: 'Settle Reach platform-fee receivable', sourceType: 'REACH_WALLET_SETTLEMENT', sourceId: input.transactionId },
      ] },
    },
  });
}

export async function postHqWalletFundingJournal(input: { tx: ReachTx; transactionId: string; amount: number; actorId: string; entryDate: Date }) {
  const accounts = await resolveHqAccounts(input.tx);
  const existing = await input.tx.hqJournalEntryLine.findFirst({ where: { sourceType: 'REACH_WALLET_FUNDING', sourceId: input.transactionId }, select: { entryId: true } });
  if (existing) return input.tx.hqJournalEntry.findUnique({ where: { id: existing.entryId } });
  return input.tx.hqJournalEntry.create({
    data: {
      entryNumber: `HQ-JE-${Date.now()}-${input.transactionId.slice(0, 8)}`,
      entryDate: input.entryDate,
      description: 'Customer funding of Reach wallet through Flutterwave',
      reference: `REACH-WALLET-FUNDING:${input.transactionId}`,
      source: 'REACH', status: 'POSTED', totalDebit: input.amount, totalCredit: input.amount, createdBy: input.actorId,
      lines: { create: [
        { accountId: accounts.walletClearing, debit: input.amount, credit: 0, description: 'Flutterwave Reach wallet clearing', sourceType: 'REACH_WALLET_FUNDING', sourceId: input.transactionId },
        { accountId: accounts.walletLiability, debit: 0, credit: input.amount, description: 'Customer Reach wallet liability', sourceType: 'REACH_WALLET_FUNDING', sourceId: input.transactionId },
      ] },
    },
  });
}

async function postHqPlatformFeeJournal(input: {
  tx: ReachTx;
  amount: number;
  entryDate: Date;
  reference: string;
  sourceId: string;
  description: string;
  actorId: string;
  debit: boolean;
}) {
  const accounts = await resolveHqAccounts(input.tx);
  const existingLine = await input.tx.hqJournalEntryLine.findFirst({
    where: { sourceType: 'REACH_PLATFORM_FEE', sourceId },
    select: { entryId: true },
  });
  if (existingLine) return input.tx.hqJournalEntry.findUnique({ where: { id: existingLine.entryId } });
  const debitAccount = input.debit ? accounts.platformFeeReceivable : accounts.platformFeeRevenue;
  const creditAccount = input.debit ? accounts.platformFeeRevenue : accounts.platformFeeReceivable;
  return input.tx.hqJournalEntry.create({
    data: {
      entryNumber: `HQ-JE-${Date.now()}-${input.sourceId.slice(0, 8)}`,
      entryDate: input.entryDate,
      description: input.description,
      reference: input.reference,
      source: 'REACH',
      status: 'POSTED',
      totalDebit: input.amount,
      totalCredit: input.amount,
      createdBy: input.actorId,
      lines: {
        create: [
          { accountId: debitAccount, debit: input.amount, credit: 0, description: input.debit ? 'HQ Reach platform-fee receivable' : 'Reverse HQ Reach platform-fee revenue', sourceType: 'REACH_PLATFORM_FEE', sourceId },
          { accountId: creditAccount, debit: 0, credit: input.amount, description: input.debit ? 'HQ Reach platform-fee revenue' : 'Reverse HQ Reach platform-fee receivable', sourceType: 'REACH_PLATFORM_FEE', sourceId },
        ],
      },
    },
  });
}

async function postReachJournal(input: {
  tx: ReachTx;
  propertyId: string;
  organizationId: string;
  actorId: string;
  entryDate: Date;
  reference: string;
  description: string;
  sourceId: string;
  sourceType: string;
  lines: Array<{ accountId: string; debit: number; credit: number; description: string }>;
}) {
  const sourceId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.sourceId)
    ? input.sourceId
    : (() => {
      const hex = createHash('sha256').update(input.sourceId).digest('hex');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
    })();
  const existing = await input.tx.journalEntryLine.findFirst({
    where: { sourceType: input.sourceType, sourceId },
    select: { entryId: true },
  });
  if (existing) return input.tx.journalEntry.findUnique({ where: { id: existing.entryId } });

  return GeneralLedgerService.postJournal(
    {
      userId: input.actorId,
      organizationId: input.organizationId,
      propertyIds: [input.propertyId],
      role: 'SYSTEM',
      permissions: [],
      outletIds: [],
    } as any,
    {
      propertyId: input.propertyId,
      entryDate: input.entryDate,
      reference: input.reference,
      description: input.description,
      sourceModule: 'REACH',
      lines: input.lines.map((line) => ({ ...line, sourceType: input.sourceType, sourceId })),
    },
    input.tx,
  );
}

export async function postReachAccrual(input: {
  tx: ReachTx;
  propertyId: string;
  organizationId: string;
  commissionId: string;
  commissionAmount: number;
  platformFeeId?: string | null;
  platformFeeAmount: number;
  actorId: string;
  entryDate: Date;
}) {
  const { accounts } = await resolveReachAccounts(input.tx, input.propertyId);
  let commissionJournalId: string | null = null;
  let platformFeeJournalId: string | null = null;
  if (input.commissionAmount > 0) {
    const journal = await postReachJournal({
      tx: input.tx,
      propertyId: input.propertyId,
      organizationId: input.organizationId,
      actorId: input.actorId,
      entryDate: input.entryDate,
      reference: `REACH-COMMISSION:${input.commissionId}`,
      description: 'LodgeCore Reach partner commission accrual',
      sourceId: `COMMISSION:${input.commissionId}`,
      sourceType: 'REACH_COMMISSION_ACCRUAL',
      lines: [
        { accountId: accounts.commissionExpense, debit: input.commissionAmount, credit: 0, description: 'Reach commission expense' },
        { accountId: accounts.commissionPayable, debit: 0, credit: input.commissionAmount, description: 'Reach partner commission payable' },
      ],
    });
    commissionJournalId = journal.id;
    await input.tx.referralCommission.update({ where: { id: input.commissionId }, data: { accrualJournalEntryId: journal.id } });
  }
  if (input.platformFeeId && input.platformFeeAmount > 0) {
    const journal = await postHqPlatformFeeJournal({
      tx: input.tx,
      actorId: input.actorId,
      entryDate: input.entryDate,
      reference: `REACH-PLATFORM-FEE:${input.platformFeeId}`,
      description: 'LodgeCore Reach platform-fee accrual',
      sourceId: `PLATFORM_FEE:${input.platformFeeId}`,
      amount: input.platformFeeAmount,
      debit: true,
    });
    platformFeeJournalId = journal.id;
    await input.tx.referralPlatformFee.update({ where: { id: input.platformFeeId }, data: { hqJournalEntryId: journal.id } });
    await refreshReachPropertyDebt(input.tx, input.organizationId, [input.propertyId], input.entryDate);
    const allocations = await settleReachWallet(input.tx, { organizationId: input.organizationId, now: input.entryDate });
    for (const allocation of allocations) {
      const settlement = await postHqWalletSettlementJournal({ tx: input.tx, transactionId: allocation.walletTransactionId, amount: allocation.amount, actorId: input.actorId, entryDate: input.entryDate });
      await input.tx.reachWalletTransaction.update({ where: { id: allocation.walletTransactionId }, data: { hqJournalEntryId: settlement?.id ?? null } });
    }
  }
  return { commissionJournalId, platformFeeJournalId };
}

export async function postReachReversal(input: {
  tx: ReachTx;
  propertyId: string;
  organizationId: string;
  actorId: string;
  entryDate: Date;
  commissionId: string;
  commissionAmount: number;
  platformFeeId?: string | null;
  platformFeeAmount: number;
  idempotencyKey: string;
}) {
  const { accounts } = await resolveReachAccounts(input.tx, input.propertyId);
  let commissionJournalId: string | null = null;
  let platformFeeJournalId: string | null = null;
  if (input.commissionAmount > 0) {
    const journal = await postReachJournal({
      tx: input.tx,
      propertyId: input.propertyId,
      organizationId: input.organizationId,
      actorId: input.actorId,
      entryDate: input.entryDate,
      reference: `REACH-REVERSAL:${input.idempotencyKey}`,
      description: 'LodgeCore Reach partner commission reversal',
      sourceId: `REVERSAL:COMMISSION:${input.idempotencyKey}`,
      sourceType: 'REACH_COMMISSION_REVERSAL',
      lines: [
        { accountId: accounts.commissionPayable, debit: input.commissionAmount, credit: 0, description: 'Reverse Reach commission payable' },
        { accountId: accounts.commissionExpense, debit: 0, credit: input.commissionAmount, description: 'Reverse Reach commission expense' },
      ],
    });
    commissionJournalId = journal.id;
  }
  if (input.platformFeeId && input.platformFeeAmount > 0) {
    const journal = await postHqPlatformFeeJournal({
      tx: input.tx,
      actorId: input.actorId,
      entryDate: input.entryDate,
      reference: `REACH-REVERSAL:${input.idempotencyKey}`,
      description: 'LodgeCore Reach platform-fee reversal',
      sourceId: `REVERSAL:PLATFORM_FEE:${input.idempotencyKey}`,
      amount: input.platformFeeAmount,
      debit: false,
    });
    platformFeeJournalId = journal.id;
  }
  return { commissionJournalId, platformFeeJournalId };
}

export async function postReachPayout(input: {
  tx: ReachTx;
  payoutId: string;
  propertyId: string;
  organizationId: string;
  actorId: string;
  settlementAccountId: string;
  amount: number;
  entryDate: Date;
}) {
  const { accounts } = await resolveReachAccounts(input.tx, input.propertyId);
  return postReachJournal({
    tx: input.tx,
    propertyId: input.propertyId,
    organizationId: input.organizationId,
    actorId: input.actorId,
    entryDate: input.entryDate,
    reference: `REACH-PAYOUT:${input.payoutId}`,
    description: 'LodgeCore Reach partner payout settlement',
    sourceId: `PAYOUT:${input.payoutId}`,
    sourceType: 'REACH_PAYOUT',
    lines: [
      { accountId: accounts.commissionPayable, debit: input.amount, credit: 0, description: 'Settle Reach partner liability' },
      { accountId: input.settlementAccountId, debit: 0, credit: input.amount, description: 'Reach payout from settlement account' },
    ],
  });
}
