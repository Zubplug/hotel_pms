import { prisma } from '@hotel-pms/db';

export type ReceivablesPosition = {
  guestReceivables: number;
  corporateReceivables: number;
  otherReceivables: number;
  totalReceivables: number;
  receivableAccountCount: number;
  guestFolioCredits: number;
  depositsHeld: number;
  availableCredits: number;
  consumedCredits: number;
};

/**
 * The canonical balance-sheet position used by management and accountant views.
 *
 * Guest debt/credit comes from non-city-ledger folios. Direct-bill and skipper
 * exposure comes from the city-ledger account subledger. City-ledger folios are
 * deliberately excluded from the guest side because they are already represented
 * by their CityLedgerAccount balance.
 */
export async function getReceivablesPosition(propertyId: string, now = new Date()): Promise<ReceivablesPosition> {
  const [guestFolios, cityLedgerAccounts, cityLedgerPayments, folioCredits, creditApplications] = await Promise.all([
    prisma.folio.findMany({
      where: { propertyId, type: { not: 'CITY_LEDGER' }, status: { not: 'VOID' } },
      select: { balance: true },
    }),
    prisma.cityLedgerAccount.findMany({
      where: { propertyId, status: 'ACTIVE' },
      select: { id: true, type: true, balance: true },
    }),
    prisma.cityLedgerEntry.findMany({
      where: { propertyId, type: 'PAYMENT', status: { not: 'REVERSED' } },
      select: { accountId: true, amount: true, allocations: { select: { amount: true } } },
    }),
    prisma.folioCredit.findMany({
      where: {
        propertyId,
        folio: { type: { not: 'CITY_LEDGER' } },
        status: { not: 'REFUNDED' },
        createdAt: { lte: now },
      },
      select: { amount: true, remainingAmount: true, status: true },
    }),
    prisma.folioCreditApplication.aggregate({
      where: {
        credit: { propertyId, folio: { type: { not: 'CITY_LEDGER' } } },
        businessDate: { lte: now },
      },
      _sum: { amount: true },
    }),
  ]);

  const guestReceivables = guestFolios.reduce((sum, folio) => {
    const balance = Number(folio.balance);
    return sum + (balance > 0 ? balance : 0);
  }, 0);
  const guestReceivableAccountCount = guestFolios.filter((folio) => Number(folio.balance) > 0).length;
  const guestFolioCredits = guestFolios.reduce((sum, folio) => {
    const balance = Number(folio.balance);
    return sum + (balance < 0 ? Math.abs(balance) : 0);
  }, 0);

  const unappliedByAccount = new Map<string, number>();
  for (const payment of cityLedgerPayments) {
    const allocated = payment.allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const unapplied = Math.max(0, Number(payment.amount) - allocated);
    if (unapplied > 0) unappliedByAccount.set(payment.accountId, (unappliedByAccount.get(payment.accountId) || 0) + unapplied);
  }

  let corporateReceivables = 0;
  let otherReceivables = 0;
  let cityLedgerReceivableAccountCount = 0;
  for (const account of cityLedgerAccounts) {
    // Refund-payable accounts are liabilities, not receivables.
    if (account.type === 'REFUND_PAYABLE') continue;
    const trueBalance = Math.max(0, Number(account.balance)) - (unappliedByAccount.get(account.id) || 0);
    if (trueBalance <= 0) continue;
    cityLedgerReceivableAccountCount += 1;
    if (account.type === 'CORPORATE') corporateReceivables += trueBalance;
    else otherReceivables += trueBalance;
  }

  const availableCredits = folioCredits.reduce((sum, credit) => {
    if (!['AVAILABLE', 'PARTIALLY_APPLIED'].includes(credit.status)) return sum;
    return sum + Math.max(0, Number(credit.remainingAmount));
  }, 0);
  const depositsHeld = folioCredits.reduce((sum, credit) => sum + Math.max(0, Number(credit.amount)), 0);
  const consumedCredits = Number(creditApplications._sum.amount || 0);

  return {
    guestReceivables,
    corporateReceivables,
    otherReceivables,
    totalReceivables: guestReceivables + corporateReceivables + otherReceivables,
    receivableAccountCount: guestReceivableAccountCount + cityLedgerReceivableAccountCount,
    guestFolioCredits,
    depositsHeld,
    availableCredits,
    consumedCredits,
  };
}
