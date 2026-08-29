import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserPropertyIds } from '@/lib/property-access';
import { ExpenseConfigurationSettings } from './expense-configuration-settings';

export default async function ExpenseConfigurationPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const propertyIds = await getUserPropertyIds(session.user.id);
  const [properties, categories, costCenters] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ where: { propertyId: { in: propertyIds } }, orderBy: [{ propertyId: 'asc' }, { name: 'asc' }] }),
    prisma.costCenter.findMany({ where: { propertyId: { in: propertyIds } }, orderBy: [{ propertyId: 'asc' }, { name: 'asc' }] }),
  ]);
  return <ExpenseConfigurationSettings properties={properties} categories={categories} costCenters={costCenters} />;
}
