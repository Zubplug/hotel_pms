export type FolioLedgerItem = {
  type: string;
  amount: number | string | { toString(): string };
  voidedAt?: Date | string | null;
};

export function calculateFolioTotals(items: FolioLedgerItem[]) {
  const activeItems = items.filter(item => !item.voidedAt);
  const totalCharges = activeItems.filter(item => item.type === 'CHARGE').reduce((sum, item) => sum + Number(item.amount), 0);
  const paymentCredits = activeItems.filter(item => item.type === 'PAYMENT').reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
  const refundDebits = activeItems.filter(item => item.type === 'REFUND').reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
  const totalPayments = paymentCredits - refundDebits;
  return { totalCharges, totalPayments, balance: totalCharges - totalPayments };
}
