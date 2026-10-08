import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireOrganizationContext } from '@/lib/organization-access';
import { HousekeepingExpenseRequestView } from '@/components/housekeeping-manager/HousekeepingExpenseRequestView';

export default async function HousekeepingManagerExpensesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const propertyId = propertyIds[0];
  if (!propertyId) return <div className="p-8 text-slate-400">No property is assigned to this account.</div>;

  const [property, expenses, categories, costCenters] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.cashExpense.findMany({
      where: { propertyId, requestedBy: session.user.id }, orderBy: { createdAt: 'desc' }, take: 100,
      include: { approvals: { orderBy: { createdAt: 'asc' } }, lineItems: { orderBy: { createdAt: 'asc' } } },
    }),
    prisma.expenseCategory.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.costCenter.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
  ]);

  const serialized = expenses.map(expense => ({
    id: expense.id,
    reference: expense.expenseReference,
    status: expense.status,
    currentApprovalStage: expense.currentApprovalStage,
    amount: Number(expense.amount),
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    payee: expense.payee,
    costCenter: expense.costCenter,
    createdAt: expense.createdAt.toISOString(),
    approvals: expense.approvals.map(approval => ({ stage: approval.stage, status: approval.status, actedAt: approval.actedAt?.toISOString() || null })),
    lineItems: expense.lineItems.map(item => ({ description: item.description, unit: item.unit, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Number(item.total) })),
  }));

  return <HousekeepingExpenseRequestView
    propertyName={property?.name || 'Property'}
    propertyId={propertyId}
    currency={property?.baseCurrency || 'NGN'}
    expenses={serialized}
    categories={categories}
    costCenters={costCenters}
  />;
}
