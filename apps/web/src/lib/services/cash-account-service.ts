import prisma from '@hotel-pms/db';

export const GENERAL_CASHIER_SAFE = 'SAFE';
export const CASH_IN_TRANSIT = 'CASH_IN_TRANSIT';
export const BANK_ACCOUNT = 'BANK_ACCOUNT';

/**
 * Makes sure every property has the two control accounts used by the
 * General Cashier workflow. Existing accounts are always reused, so this is
 * safe to call from page loads, seed flows, and future background jobs.
 */
export async function ensureCashierControlAccounts(propertyId: string) {
  return prisma.$transaction((tx) => ensureCashierControlAccountsForClient(tx, propertyId));
}

export async function ensureCashierControlAccountsForClient(tx: any, propertyId: string) {
    const definitions = [
      { type: GENERAL_CASHIER_SAFE, name: 'General Cashier Safe', aliases: ['Reception Safe'] },
      { type: CASH_IN_TRANSIT, name: 'Cash in Transit', aliases: ['Pending Bank Deposits'] },
    ];

    const accounts = [];
    for (const definition of definitions) {
      const existing = await tx.cashAccount.findFirst({
        where: {
          propertyId,
          OR: [
            { type: definition.type },
            { name: definition.name },
            { name: { in: definition.aliases } },
          ],
        },
      });

      const account = existing
        ? existing.type === definition.type
          ? existing
          : await tx.cashAccount.update({
              where: { id: existing.id },
              data: { type: definition.type },
            })
        : await tx.cashAccount.create({
            data: {
              propertyId,
              name: definition.name,
              type: definition.type,
              balance: 0,
              isActive: true,
            },
          });
      accounts.push(account);
    }

  return accounts;
}

export async function ensureBankAccountForClient(
  tx: any,
  propertyId: string,
  bankName?: string,
  bankAccount?: string
) {
  const name = bankName?.trim() || bankAccount?.trim()
    ? `${bankName?.trim() || 'Bank'}${bankAccount?.trim() ? ` · ${bankAccount.trim()}` : ''}`
    : 'Main Corporate Bank Account';

  return (
    (await tx.cashAccount.findFirst({
      where: { propertyId, type: BANK_ACCOUNT, name },
    })) ??
    tx.cashAccount.create({
      data: { propertyId, name, type: BANK_ACCOUNT, bankName: bankName?.trim() || null, accountNumber: bankAccount?.trim() || null, isDefault: true, balance: 0, isActive: true },
    })
  );
}

export async function ensureExpenseCounterpartyForClient(tx: any, propertyId: string) {
  return (
    (await tx.cashAccount.findFirst({
      where: { propertyId, type: 'EXTERNAL', name: 'Cash Expense Clearing' },
    })) ??
    tx.cashAccount.create({
      data: { propertyId, name: 'Cash Expense Clearing', type: 'EXTERNAL', balance: 0, isActive: true },
    })
  );
}
