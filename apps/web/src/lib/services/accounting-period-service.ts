import { randomUUID } from 'crypto';
import { prisma, AccountingPeriodStatus } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { FixedAssetService } from './fixed-asset-service';

export class AccountingPeriodService {
  static async list(ctx: TenantContext, propertyId: string) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    return prisma.accountingPeriod.findMany({
      where: { propertyId },
      orderBy: { periodStart: 'desc' }
    });
  }

  static async getActive(propertyId: string) {
    return prisma.accountingPeriod.findFirst({
      where: { propertyId, status: 'OPEN' },
      orderBy: { periodStart: 'desc' }
    });
  }

  static async validatePeriodOpen(propertyId: string, date: Date) {
    const period = await prisma.accountingPeriod.findFirst({
      where: {
        propertyId,
        periodStart: { lte: date },
        periodEnd: { gte: date },
        status: 'CLOSED'
      }
    });

    if (period) {
      throw new Error(`The accounting period for ${date.toISOString().split('T')[0]} is CLOSED.`);
    }
  }

  static async create(ctx: TenantContext, input: { propertyId: string; name: string; periodStart: Date; periodEnd: Date; notes?: string }) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');

    // Check for overlapping periods
    const overlap = await prisma.accountingPeriod.findFirst({
      where: {
        propertyId: input.propertyId,
        OR: [
          { periodStart: { lte: input.periodEnd }, periodEnd: { gte: input.periodStart } }
        ]
      }
    });

    if (overlap) {
      throw new Error(`Period overlaps with existing period ${overlap.name}`);
    }

    return prisma.$transaction(async (tx) => {
      const period = await tx.accountingPeriod.create({
        data: {
          ...input,
          status: 'OPEN',
          openedBy: ctx.userId
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          userId: ctx.userId,
          action: 'ACCOUNTING_PERIOD_OPENED',
          resource: 'AccountingPeriod',
          resourceId: period.id,

          requestId: randomUUID(),
          newValue: { name: input.name }
        }
      });

      return period;
    });
  }

  static async close(ctx: TenantContext, periodId: string) {
    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new Error('Period not found');
    if (!ctx.propertyIds.includes(period.propertyId)) throw new Error('Unauthorized');

    if (period.status !== 'OPEN') {
      throw new Error(`Cannot close period with status ${period.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Mark as CLOSING to prevent new entries
      await tx.accountingPeriod.update({
        where: { id: periodId },
        data: { status: 'CLOSING' }
      });

      // 2. Run depreciation
      await FixedAssetService.runDepreciationForPeriod(ctx, tx, period.propertyId, period.id, period.periodEnd);

      // 3. Close period
      const closed = await tx.accountingPeriod.update({
        where: { id: periodId },
        data: {
          status: 'CLOSED',
          closedBy: ctx.userId,
          closedAt: new Date()
        }
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: period.propertyId,
          userId: ctx.userId,
          action: 'ACCOUNTING_PERIOD_CLOSED',
          resource: 'AccountingPeriod',
          resourceId: period.id,

          requestId: randomUUID(),
          newValue: { name: period.name }
        }
      });

      return closed;
    });
  }
}
