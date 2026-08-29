import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserPropertyIds } from '@/lib/property-access';
import { FinancialAccountsSettings } from './financial-accounts-settings';

export default async function FinancialAccountsSettingsPage() {
  const actor = await auth();
  if (!actor?.user) redirect('/login');
  const propertyIds = await getUserPropertyIds(actor.user.id);
  const [properties, accounts] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.cashAccount.findMany({ where: { propertyId: { in: propertyIds }, type: 'BANK_ACCOUNT' }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
  ]);
  return <FinancialAccountsSettings properties={properties} accounts={accounts.map(account => ({ id: account.id, propertyId: account.propertyId, name: account.name, bankName: account.bankName, accountNumber: account.accountNumber, isDefault: account.isDefault, isActive: account.isActive, balance: Number(account.balance) }))} />;
}
