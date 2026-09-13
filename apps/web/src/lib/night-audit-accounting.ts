type Account = { id: string; code: string; name: string };

const ACCOUNT_CODES = {
  guestLedger: '1100',
  cardReceivable: '1110',
  cash: '1000',
  bankTransfer: '1130',
  posClearing: '1120',
  cityLedger: '1140',
  roomsRevenue: '4050',
  fnbRevenue: '4250',
  otherRevenue: '4400',
  taxPayable: '2200',
  discounts: '4900',
  refunds: '4910',
  serviceCharge: '2210',
} as const;

type PostingLine = {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
  sourceType: string;
  sourceId: string;
  departmentId?: string;
  outletId?: string;
};

function addLine(lines: PostingLine[], line: PostingLine) {
  if (line.debit <= 0 && line.credit <= 0) return;
  lines.push(line);
}

/**
 * Posts one idempotent, source-linked Night Audit journal. A missing mapping
 * is returned as a control exception so the audit never creates a partially
 * mapped or silently misclassified journal.
 */
export async function postNightAuditJournal(tx: any, input: {
  propertyId: string;
  businessDate: Date;
  auditId: string;
  createdBy: string | null;
}) {
  const existing = await tx.journalEntry.findUnique({
    where: { propertyId_nightAuditId: { propertyId: input.propertyId, nightAuditId: input.auditId } },
    select: { id: true, totalDebit: true, totalCredit: true },
  });
  if (existing) return { status: 'POSTED', journalEntryId: existing.id, missingAccounts: [] as string[], lineCount: 0 };

  if (!input.createdBy) return { status: 'MISSING_OPERATOR', journalEntryId: null, missingAccounts: ['createdBy'], lineCount: 0 };
  // Night Audit uses one canonical chart across all properties. Legacy codes
  // are normalized by migration before posting; do not silently fall back to
  // account names or property-specific codes.
  const accounts = await tx.chartOfAccount.findMany({
    where: { propertyId: input.propertyId, code: { in: Object.values(ACCOUNT_CODES) }, isActive: true },
    select: { id: true, code: true, name: true },
  }) as Account[];
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const resolved = {
    guestLedger: byCode.get(ACCOUNT_CODES.guestLedger),
    cardReceivable: byCode.get(ACCOUNT_CODES.cardReceivable),
    cash: byCode.get(ACCOUNT_CODES.cash),
    bankTransfer: byCode.get(ACCOUNT_CODES.bankTransfer),
    posClearing: byCode.get(ACCOUNT_CODES.posClearing),
    cityLedger: byCode.get(ACCOUNT_CODES.cityLedger),
    roomsRevenue: byCode.get(ACCOUNT_CODES.roomsRevenue),
    fnbRevenue: byCode.get(ACCOUNT_CODES.fnbRevenue),
    otherRevenue: byCode.get(ACCOUNT_CODES.otherRevenue),
    taxPayable: byCode.get(ACCOUNT_CODES.taxPayable),
    discounts: byCode.get(ACCOUNT_CODES.discounts),
    refunds: byCode.get(ACCOUNT_CODES.refunds),
    serviceCharge: byCode.get(ACCOUNT_CODES.serviceCharge),
  };
  const missingAccounts = Object.entries(resolved).filter(([, account]) => !account).map(([key]) => key);
  if (missingAccounts.length) return { status: 'MISSING_MAPPING', journalEntryId: null, missingAccounts, lineCount: 0 };
  const account = (key: keyof typeof resolved) => resolved[key]!;

  const dateEnd = new Date(input.businessDate.getTime() + 86_400_000);
  const [folioItems, payments, refunds, posOrders, period, fnbDepartment] = await Promise.all([
    tx.folioItem.findMany({
      where: { folio: { propertyId: input.propertyId }, businessDate: input.businessDate, voidedAt: null, type: { in: ['CHARGE', 'TAX', 'DISCOUNT', 'ADJUSTMENT'] } },
      select: { id: true, type: true, amount: true, source: true, revenueCategory: true, description: true },
    }),
    tx.payment.findMany({
      where: { propertyId: input.propertyId, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] }, OR: [{ businessDate: input.businessDate }, { businessDate: null, createdAt: { gte: input.businessDate, lt: dateEnd } }] },
      select: { id: true, method: true, amount: true, reference: true },
    }),
    tx.refund.findMany({
      where: { propertyId: input.propertyId, businessDate: input.businessDate, status: 'COMPLETED' },
      select: { id: true, method: true, amount: true, reason: true, payment: { select: { method: true } } },
    }),
    tx.posOrder.findMany({
      where: { propertyId: input.propertyId, businessDate: input.businessDate, status: 'CLOSED', paymentStatus: 'PAID', folioId: null },
      select: { id: true, total: true, subtotal: true, taxAmount: true, serviceCharge: true, orderNumber: true, outletId: true, payments: { where: { status: 'CONFIRMED' }, select: { id: true, amount: true, method: true } } },
    }),
    tx.accountingPeriod.findFirst({ where: { propertyId: input.propertyId, periodStart: { lte: input.businessDate }, periodEnd: { gte: input.businessDate }, status: { in: ['OPEN', 'CLOSING'] } }, select: { id: true } }),
    tx.department.findFirst({ where: { propertyId: input.propertyId, name: { in: ['F&B', 'Food & Beverage', 'Food and Beverage'] } }, select: { id: true } }),
  ]);
  if (!period) return { status: 'ACCOUNTING_PERIOD_LOCKED', journalEntryId: null, missingAccounts: ['OPEN_ACCOUNTING_PERIOD'], lineCount: 0 };

  const lines: PostingLine[] = [];
  for (const item of folioItems) {
    const amount = Math.abs(Number(item.amount));
    if (!amount) continue;
    if (item.type === 'TAX') {
      addLine(lines, { accountId: account('guestLedger').id, debit: amount, credit: 0, description: item.description, sourceType: 'FOLIO_ITEM', sourceId: item.id });
      addLine(lines, { accountId: account('taxPayable').id, debit: 0, credit: amount, description: item.description, sourceType: 'FOLIO_ITEM', sourceId: item.id });
    } else if (item.type === 'DISCOUNT' || item.type === 'ADJUSTMENT' && Number(item.amount) < 0) {
      addLine(lines, { accountId: account('discounts').id, debit: amount, credit: 0, description: item.description, sourceType: 'FOLIO_ITEM', sourceId: item.id });
      addLine(lines, { accountId: account('guestLedger').id, debit: 0, credit: amount, description: item.description, sourceType: 'FOLIO_ITEM', sourceId: item.id });
    } else {
      const key = item.source === 'ROOM_CHARGE' || item.revenueCategory === 'ROOM' ? 'roomsRevenue' : item.source === 'POS' || item.revenueCategory === 'FNB' ? 'fnbRevenue' : 'otherRevenue';
      addLine(lines, { accountId: account('guestLedger').id, debit: amount, credit: 0, description: item.description, sourceType: 'FOLIO_ITEM', sourceId: item.id });
      addLine(lines, { accountId: account(key).id, debit: 0, credit: amount, description: item.description, sourceType: 'FOLIO_ITEM', sourceId: item.id });
    }
  }
  for (const payment of payments) {
    const amount = Number(payment.amount);
    if (!amount) continue;
    const tender = payment.method === 'CITY_LEDGER' ? account('cityLedger') : payment.method === 'CASH' ? account('cash') : payment.method === 'POS' ? account('posClearing') : ['CARD', 'CARD_OFFLINE', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT'].includes(String(payment.method)) ? account('cardReceivable') : payment.method === 'BANK_TRANSFER' ? account('bankTransfer') : account('guestLedger');
    addLine(lines, { accountId: tender.id, debit: amount, credit: 0, description: `Payment ${payment.reference || payment.id}`, sourceType: 'PAYMENT', sourceId: payment.id });
    addLine(lines, { accountId: account('guestLedger').id, debit: 0, credit: amount, description: `Payment ${payment.reference || payment.id}`, sourceType: 'PAYMENT', sourceId: payment.id });
  }
  for (const refund of refunds) {
    const amount = Number(refund.amount);
    if (!amount) continue;
    const refundMethod = String(refund.method || '').toUpperCase();
    const originalMethod = String(refund.payment?.method || '').toUpperCase();
    const tender = refundMethod === 'CASH' || (refundMethod === 'ORIGINAL_PAYMENT' && originalMethod === 'CASH')
      ? account('cash')
      : refundMethod === 'BANK_TRANSFER' || (refundMethod === 'ORIGINAL_PAYMENT' && originalMethod === 'BANK_TRANSFER')
        ? account('bankTransfer')
        : refundMethod === 'POS' || (refundMethod === 'ORIGINAL_PAYMENT' && originalMethod === 'POS')
          ? account('posClearing')
          : account('cardReceivable');
    addLine(lines, { accountId: account('refunds').id, debit: amount, credit: 0, description: refund.reason, sourceType: 'REFUND', sourceId: refund.id });
    addLine(lines, { accountId: tender.id, debit: 0, credit: amount, description: refund.reason, sourceType: 'REFUND', sourceId: refund.id });
  }
  for (const order of posOrders) {
    const total = Number(order.total);
    const tax = Number(order.taxAmount);
    const serviceCharge = Number(order.serviceCharge);
    const revenue = Math.max(0, total - tax - serviceCharge);
    const paid = order.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0);
    const departmentId = fnbDepartment?.id || undefined;
    
    if (!paid) continue;
    for (const payment of order.payments) {
      const tender = payment.method === 'CASH' ? account('cash') : payment.method === 'POS' ? account('posClearing') : ['CARD', 'CARD_OFFLINE', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT'].includes(String(payment.method)) ? account('cardReceivable') : account('guestLedger');
      addLine(lines, { accountId: tender.id, debit: Number(payment.amount), credit: 0, description: `POS payment for ${order.orderNumber}`, sourceType: 'POS_PAYMENT', sourceId: payment.id, outletId: order.outletId, departmentId });
    }
    addLine(lines, { accountId: account('fnbRevenue').id, debit: 0, credit: revenue, description: `POS order ${order.orderNumber}`, sourceType: 'POS_ORDER', sourceId: order.id, outletId: order.outletId, departmentId });
    addLine(lines, { accountId: account('taxPayable').id, debit: 0, credit: tax, description: `POS tax ${order.orderNumber}`, sourceType: 'POS_ORDER', sourceId: order.id, outletId: order.outletId, departmentId });
    addLine(lines, { accountId: account('serviceCharge').id, debit: 0, credit: serviceCharge, description: `POS service charge ${order.orderNumber}`, sourceType: 'POS_ORDER', sourceId: order.id, outletId: order.outletId, departmentId });
    const residual = paid - revenue - tax - serviceCharge;
    if (residual > 0.01) addLine(lines, { accountId: account('otherRevenue').id, debit: 0, credit: residual, description: `POS settlement residual ${order.orderNumber}`, sourceType: 'POS_ORDER', sourceId: order.id, outletId: order.outletId, departmentId });
  }

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (!lines.length || Math.abs(totalDebit - totalCredit) > 0.01) return { status: 'UNBALANCED_SOURCE', journalEntryId: null, missingAccounts: ['SOURCE_TOTALS_DO_NOT_BALANCE'], lineCount: lines.length };
  const entry = await tx.journalEntry.create({
    data: {
      propertyId: input.propertyId,
      periodId: period.id,
      nightAuditId: input.auditId,
      entryNumber: `NA-${input.propertyId.slice(0, 8)}-${input.businessDate.toISOString().slice(0, 10)}-${input.auditId.slice(0, 8)}`,
      entryDate: input.businessDate,
      description: `Night Audit close ${input.businessDate.toISOString().slice(0, 10)}`,
      reference: input.auditId,
      source: 'AUTO_NIGHT_AUDIT',
      status: 'POSTED',
      totalDebit,
      totalCredit,
      postedBy: input.createdBy,
      createdBy: input.createdBy,
      lines: { create: lines },
    },
    select: { id: true },
  });
  return { status: 'POSTED', journalEntryId: entry.id, missingAccounts: [] as string[], lineCount: lines.length };
}

export async function buildNightAuditBalanceProof(tx: any, input: {
  propertyId: string;
  businessDate: Date;
  packageId?: string;
}) {
  const previous = await tx.nightAuditClosePackage.findFirst({
    where: { propertyId: input.propertyId, businessDate: { lt: input.businessDate } },
    orderBy: { businessDate: 'desc' },
    include: { accountBalances: true },
  });
  const previousByKey = new Map((previous?.accountBalances || []).map((row: any) => [`${row.ledgerType}:${row.accountKey}`, row]));
  const [folioActivity, guestClosing, cityClosing, cashClosing, frontdeskCashClosing, postedEntries] = await Promise.all([
    tx.folioItem.aggregate({
      where: { folio: { propertyId: input.propertyId }, businessDate: input.businessDate, voidedAt: null },
      _sum: { amount: true },
    }),
    tx.folio.aggregate({ where: { propertyId: input.propertyId, type: { not: 'CITY_LEDGER' }, status: { not: 'VOID' } }, _sum: { balance: true } }),
    tx.cityLedgerAccount.aggregate({ where: { propertyId: input.propertyId, status: { not: 'VOID' } }, _sum: { balance: true } }),
    tx.posSession.aggregate({ where: { propertyId: input.propertyId, businessDate: input.businessDate }, _sum: { expectedCash: true, actualCash: true, variance: true } }),
    tx.frontdeskSession.aggregate({ where: { propertyId: input.propertyId, businessDate: input.businessDate }, _sum: { systemExpectedCash: true, declaredCash: true, variance: true } }),
    tx.journalEntry.findMany({
      where: { propertyId: input.propertyId, status: 'POSTED', entryDate: { lte: input.businessDate } },
      select: { entryDate: true, lines: { select: { debit: true, credit: true, account: { select: { code: true } } } } },
    }),
  ]);
  const activity = Number(folioActivity._sum.amount || 0);
  const journalAccounts = ['1000', '1100', '1110', '1120', '1130', '1140', '2200'].map((code) => {
    const before = postedEntries.reduce((sum: number, entry: any) => entry.entryDate < input.businessDate
      ? sum + journalNet(code, entry.lines)
      : sum, 0);
    const daily = postedEntries.reduce((sum: number, entry: any) => entry.entryDate.getTime() === input.businessDate.getTime()
      ? sum + journalNet(code, entry.lines)
      : sum, 0);
    const through = before + daily;
    return { code, before, daily, through };
  });
  const accountBalance = (code: string) => journalAccounts.find((row) => row.code === code)!;
  const rows = [
    makeBalanceRow('SUBLEDGER', 'GUEST_LEDGER', previousByKey.get('SUBLEDGER:GUEST_LEDGER'), accountBalance('1100').daily, Number(guestClosing._sum.balance || 0), 'Guest ledger balance is sourced from active folios and checked against the posted GL activity.'),
    makeBalanceRow('SUBLEDGER', 'CITY_LEDGER', previousByKey.get('SUBLEDGER:CITY_LEDGER'), accountBalance('1140').daily, Number(cityClosing._sum.balance || 0), 'City ledger balance is sourced from active city-ledger accounts and checked against the posted GL activity.'),
    makeCashBalanceRow(previousByKey.get('CASH:CASH_ACCOUNTS'), cashClosing, frontdeskCashClosing, accountBalance('1000').daily),
    makeJournalBalanceRow('SETTLEMENT', 'CARD_RECEIVABLE', previousByKey.get('SETTLEMENT:CARD_RECEIVABLE'), accountBalance('1110'), 'Card receivable is sourced from dated posted payment and refund journals.'),
    makeJournalBalanceRow('SETTLEMENT', 'POS_CLEARING', previousByKey.get('SETTLEMENT:POS_CLEARING'), accountBalance('1120'), 'POS clearing is sourced from dated posted POS payment and refund journals.'),
    makeJournalBalanceRow('SETTLEMENT', 'BANK_TRANSFER', previousByKey.get('SETTLEMENT:BANK_TRANSFER'), accountBalance('1130'), 'Bank transfer receivable is sourced from dated posted payment and refund journals.'),
    makeJournalBalanceRow('LIABILITY', 'TAX_PAYABLE', previousByKey.get('LIABILITY:TAX_PAYABLE'), accountBalance('2200'), 'Tax payable is sourced from dated posted tax journals.'),
  ];
  return rows;
}

function journalNet(code: string, lines: any[]) {
  return lines.reduce((sum: number, line: any) => {
    if (line.account.code !== code) return sum;
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    return sum + (['2200'].includes(code) ? credit - debit : debit - credit);
  }, 0);
}

function makeCashBalanceRow(previous: any, cashClosing: any, frontdeskCashClosing: any, journalActivity: number) {
  const expectedCash = Number(cashClosing._sum.expectedCash || 0) + Number(frontdeskCashClosing._sum.systemExpectedCash || 0);
  const posActual = cashClosing._sum.actualCash;
  const frontdeskActual = frontdeskCashClosing._sum.declaredCash;
  const actualCash = posActual === null && frontdeskActual === null
    ? null
    : Number(posActual || 0) + Number(frontdeskActual || 0);
  if (actualCash === null) return makeUnavailableBalanceRow('CASH', 'CASH_ACCOUNTS', previous, 'Cash sessions have not supplied a declared closing balance.');
  const opening = previous ? Number(previous.expectedClosing) : expectedCash - journalActivity;
  const activity = journalActivity;
  const expected = opening + activity;
  return { ledgerType: 'CASH', accountKey: 'CASH_ACCOUNTS', openingBalance: opening, activityDebit: Math.max(activity, 0), activityCredit: Math.max(-activity, 0), expectedClosing: expected, actualClosing: actualCash, variance: actualCash - expected, status: Math.abs(actualCash - expected) < 0.01 ? 'PROVEN' : 'HAS_VARIANCE', resolution: 'Cash expected and declared balances are sourced from dated POS and front-desk sessions and checked against the posted GL activity.' };
}

function makeJournalBalanceRow(ledgerType: string, accountKey: string, previous: any, current: { before: number; daily: number; through: number }, resolution: string) {
  const opening = previous ? Number(previous.expectedClosing) : current.before;
  const expected = opening + current.daily;
  const actual = current.through;
  return { ledgerType, accountKey, openingBalance: opening, activityDebit: Math.max(current.daily, 0), activityCredit: Math.max(-current.daily, 0), expectedClosing: expected, actualClosing: actual, variance: actual - expected, status: Math.abs(actual - expected) < 0.01 ? 'PROVEN' : 'HAS_VARIANCE', resolution };
}

function makeBalanceRow(ledgerType: string, accountKey: string, previous: any, activity: number, actual: number, resolution: string) {
  // When the first close has no prior immutable package, establish the
  // opening balance from the dated subledger closing balance less the day's
  // canonical GL activity. Subsequent closes use the prior package opening.
  const opening = previous ? Number(previous.expectedClosing) : actual - activity;
  const expected = opening + activity;
  const variance = actual - expected;
  return { ledgerType, accountKey, openingBalance: opening, activityDebit: Math.max(activity, 0), activityCredit: Math.max(-activity, 0), expectedClosing: expected, actualClosing: actual, variance, status: Math.abs(variance) < 0.01 ? 'PROVEN' : 'HAS_VARIANCE', resolution: previous ? resolution : `${resolution} Opening balance was established from the first dated close subledger.` };
}

function makeUnavailableBalanceRow(ledgerType: string, accountKey: string, previous: any, resolution: string) {
  const opening = previous ? Number(previous.expectedClosing) : 0;
  return { ledgerType, accountKey, openingBalance: opening, activityDebit: 0, activityCredit: 0, expectedClosing: opening, actualClosing: null, variance: null, status: 'UNAVAILABLE', resolution };
}
