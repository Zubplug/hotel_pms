import { randomUUID } from 'crypto';
import { prisma, BudgetStatus, Prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { startOfDay, endOfDay } from 'date-fns';

export class BudgetService {
  static async list(ctx: TenantContext, propertyId: string, filters?: { status?: BudgetStatus; year?: number }) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    
    const where: Prisma.BudgetWhereInput = {
      propertyId,
      ...(filters?.status && { status: filters.status })
    };

    if (filters?.year) {
      where.periodStart = { gte: new Date(filters.year, 0, 1) };
      where.periodEnd = { lte: new Date(filters.year, 11, 31) };
    }

    return prisma.budget.findMany({
      where,
      include: { lines: true },
      orderBy: { periodStart: 'desc' }
    });
  }

  static async create(
    ctx: TenantContext,
    input: {
      propertyId: string;
      name: string;
      description?: string;
      periodStart: Date;
      periodEnd: Date;
      lines: Array<{ department: string; category: string; amount: number; isRevenue: boolean; notes?: string }>;
    }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');

    let totalRev = 0;
    let totalExp = 0;
    input.lines.forEach(l => {
      if (l.isRevenue) totalRev += l.amount;
      else totalExp += l.amount;
    });

    return prisma.$transaction(async (tx) => {
      const budget = await tx.budget.create({
        data: {
          propertyId: input.propertyId,
          name: input.name,
          budgetType: 'CUSTOM',
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalRevenueBudget: totalRev,
          totalExpenseBudget: totalExp,
          status: 'DRAFT',
          createdBy: ctx.userId,
          lines: {
            create: input.lines.map(line => ({
              department: line.department,
              category: line.category,
              totalAmount: line.amount,
              description: line.notes
            }))
          }
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          userId: ctx.userId,
          action: 'BUDGET_CREATED',
          resource: 'Budget',
          resourceId: budget.id,

          requestId: randomUUID(),
          newValue: { name: budget.name, totalRev, totalExp }
        }
      });

      return budget;
    });
  }

  static async submitForApproval(ctx: TenantContext, budgetId: string) {
    const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) throw new Error('Budget not found');
    if (!ctx.propertyIds.includes(budget.propertyId)) throw new Error('Unauthorized');

    if (budget.status !== 'DRAFT') {
      throw new Error(`Cannot submit budget with status ${budget.status}`);
    }

    return prisma.budget.update({
      where: { id: budgetId },
      data: { status: 'SUBMITTED' }
    });
  }

  static async approve(ctx: TenantContext, budgetId: string) {
    const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) throw new Error('Budget not found');
    if (!ctx.propertyIds.includes(budget.propertyId)) throw new Error('Unauthorized');

    if (ctx.role !== 'SUPER_ADMIN' && ctx.role !== 'GENERAL_MANAGER') {
      throw new Error('Only General Manager or Super Admin can approve budgets');
    }

    if (budget.status !== 'SUBMITTED') {
      throw new Error(`Cannot approve budget with status ${budget.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const approved = await tx.budget.update({
        where: { id: budgetId },
        data: {
          status: 'APPROVED',
          approvedBy: ctx.userId,
          approvedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: budget.propertyId,
          userId: ctx.userId,
          action: 'BUDGET_APPROVED',
          resource: 'Budget',
          resourceId: budget.id,

          requestId: randomUUID(),
          newValue: {}
        }
      });

      return approved;
    });
  }

  static async getActuals(propertyId: string, budgetId: string) {
    const budget = await prisma.budget.findUnique({ where: { id: budgetId }, include: { lines: true } });
    if (!budget) throw new Error('Budget not found');

    const start = startOfDay(budget.periodStart);
    const end = endOfDay(budget.periodEnd);

    // This is a naive actuals calculation - in a full implementation, you would sum up mapped GL accounts.
    // For now, we sum FolioItems for Revenue and CashExpenses for Expenses.
    
    const revenues = await prisma.folioItem.aggregate({
      where: { folio: { propertyId }, type: 'CHARGE', businessDate: { gte: start, lte: end }, voidedAt: null },
      _sum: { amount: true }
    });

    const expenses = await prisma.cashExpense.aggregate({
      where: { propertyId, status: 'PAID', paidAt: { gte: start, lte: end } },
      _sum: { amount: true }
    });

    return {
      budgetedRevenue: Number(budget.totalRevenueBudget),
      actualRevenue: Number(revenues._sum.amount ?? 0),
      budgetedExpense: Number(budget.totalExpenseBudget),
      actualExpense: Number(expenses._sum.amount ?? 0),
      varianceRevenue: Number(revenues._sum.amount ?? 0) - Number(budget.totalRevenueBudget),
      varianceExpense: Number(budget.totalExpenseBudget) - Number(expenses._sum.amount ?? 0) // positive means under budget
    };
  }
}
