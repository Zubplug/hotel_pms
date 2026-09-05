import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireOrganizationContext } from '@/lib/organization-access';
import { ExpenseWorkspace } from './expense-workspace';
import { ReceiptText } from 'lucide-react';

export default async function CashExpensesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const [expenses, categories, costCenters] = await Promise.all([
    prisma.cashExpense.findMany({ where: { propertyId: { in: propertyIds as string[] } }, orderBy: { createdAt: 'desc' } }),
    propertyIds.length === 1 ? prisma.expenseCategory.findMany({ where: { propertyId: propertyIds[0], isActive: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
    propertyIds.length === 1 ? prisma.costCenter.findMany({ where: { propertyId: propertyIds[0], isActive: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ]);
  const role = String((session.user as any).role || '').toUpperCase();
  const serialized = expenses.map(expense => ({ id: expense.id, expenseReference: expense.expenseReference, status: expense.status, amount: Number(expense.amount), currency: expense.currency, category: expense.category, description: expense.description, payee: expense.payee, receiptUrl: expense.receiptUrl, costCenter: expense.costCenter, createdAt: expense.createdAt.toISOString() }));
  return <div className="min-h-full"><div className="bg-gradient-to-r from-[#0b1120] to-[#1e2d50] px-6 py-7 sm:px-8"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-indigo-200"><ReceiptText className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold tracking-tight text-white">Cash Expenses</h1><p className="mt-1 text-sm text-slate-400">Record, approve, and pay controlled expenses from the General Cashier Safe.</p></div></div></div><div className="mx-auto max-w-screen-xl px-6 py-7"><ExpenseWorkspace propertyId={propertyIds.length === 1 ? propertyIds[0] : ''} expenses={serialized} categories={categories.map(item => ({ id: item.id, code: item.code, name: item.name }))} costCenters={costCenters.map(item => ({ id: item.id, code: item.code, name: item.name }))} role={role} /></div></div>;
}
