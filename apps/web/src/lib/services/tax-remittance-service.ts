import { randomUUID } from 'crypto';
import { prisma, TaxRemittanceStatus, Prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { startOfDay, endOfDay } from 'date-fns';

export class TaxRemittanceService {
  /**
   * Calculates total tax collected for a given period and tax type.
   * Pulls audited taxes from NightAuditFinancialSnapshot for closed dates,
   * and live taxes from FolioItem for open dates.
   */
  static async getCollectedForPeriod(propertyId: string, periodStart: Date, periodEnd: Date) {
    const start = startOfDay(periodStart);
    const end = endOfDay(periodEnd);

    // 1. Get audited taxes from NightAudit
    const audits = await prisma.nightAudit.findMany({
      where: {
        propertyId,
        businessDate: { gte: start, lte: end },
        status: { in: ['COMPLETED', 'COMPLETED_WITH_EXCEPTIONS'] }
      },
      include: {
        financialSnapshot: true
      }
    });

    let auditedTaxes = 0;
    const auditedDates: string[] = [];

    for (const audit of audits) {
      if (audit.financialSnapshot) {
        auditedTaxes += Number(audit.financialSnapshot.taxes || 0);
        auditedDates.push(audit.businessDate.toISOString());
      }
    }

    // 2. Get live taxes from FolioItem for dates not yet audited
    const liveItems = await prisma.folioItem.findMany({
      where: {
        folio: { propertyId },
        type: 'TAX',
        voidedAt: null,
        businessDate: { gte: start, lte: end },
        NOT: {
          businessDate: { in: auditedDates.map(d => new Date(d)) }
        }
      }
    });

    const liveItemTaxes = liveItems.reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      total: auditedTaxes + liveItemTaxes,
      breakdown: {
        audited: auditedTaxes,
        live: liveItemTaxes
      }
    };
  }

  static async list(
    ctx: TenantContext,
    propertyId: string,
    filters?: { status?: TaxRemittanceStatus; taxType?: string; fromDate?: Date; toDate?: Date }
  ) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');

    const where: Prisma.TaxRemittanceWhereInput = {
      propertyId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.taxType && { taxType: filters.taxType }),
      ...(filters?.fromDate && { periodStart: { gte: filters.fromDate } }),
      ...(filters?.toDate && { periodEnd: { lte: filters.toDate } })
    };

    return prisma.taxRemittance.findMany({
      where,
      include: { tax: true },
      orderBy: { periodStart: 'desc' }
    });
  }

  static async create(
    ctx: TenantContext,
    input: {
      propertyId: string;
      taxId?: string;
      periodStart: Date;
      periodEnd: Date;
      taxType: string;
      collectedAmount: number;
      remittedAmount: number;
      remittanceDate: Date;
      remittanceRef?: string;
      authorityName?: string;
      attachmentUrl?: string;
      notes?: string;
    }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');
    if (input.remittedAmount <= 0) throw new Error('Remitted amount must be greater than zero');

    return prisma.$transaction(async (tx) => {
      const remittance = await tx.taxRemittance.create({
        data: {
          ...input,
          status: 'SUBMITTED', // Created by Accountant and submitted for approval
          recordedBy: ctx.userId
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          userId: ctx.userId,
          action: 'TAX_REMITTANCE_SUBMITTED',
          resource: 'TaxRemittance',
          resourceId: remittance.id,

          requestId: randomUUID(),
          newValue: { taxType: input.taxType, remittedAmount: input.remittedAmount }
        }
      });

      return remittance;
    });
  }

  static async approve(ctx: TenantContext, remittanceId: string) {
    const remittance = await prisma.taxRemittance.findUnique({ where: { id: remittanceId } });
    if (!remittance) throw new Error('Remittance not found');
    if (!ctx.propertyIds.includes(remittance.propertyId)) throw new Error('Unauthorized');

    // Only GM or Super Admin can approve tax remittances
    if (ctx.role !== 'SUPER_ADMIN' && ctx.role !== 'GENERAL_MANAGER') {
      throw new Error('Only a General Manager or Super Admin can approve tax remittances');
    }

    if (remittance.status !== 'SUBMITTED') {
      throw new Error(`Cannot approve remittance with status ${remittance.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.taxRemittance.update({
        where: { id: remittanceId },
        data: {
          status: 'REMITTED', // Immediately becomes REMITTED on approval
          approvedBy: ctx.userId,
          approvedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: remittance.propertyId,
          userId: ctx.userId,
          action: 'TAX_REMITTANCE_APPROVED',
          resource: 'TaxRemittance',
          resourceId: remittance.id,

          requestId: randomUUID(),
          newValue: {}
        }
      });

      return updated;
    });
  }

  static async reject(ctx: TenantContext, remittanceId: string, reason: string) {
    const remittance = await prisma.taxRemittance.findUnique({ where: { id: remittanceId } });
    if (!remittance) throw new Error('Remittance not found');
    if (!ctx.propertyIds.includes(remittance.propertyId)) throw new Error('Unauthorized');

    if (ctx.role !== 'SUPER_ADMIN' && ctx.role !== 'GENERAL_MANAGER') {
      throw new Error('Only a General Manager or Super Admin can reject tax remittances');
    }

    if (remittance.status !== 'SUBMITTED') {
      throw new Error(`Cannot reject remittance with status ${remittance.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.taxRemittance.update({
        where: { id: remittanceId },
        data: {
          status: 'REJECTED',
          notes: remittance.notes ? `${remittance.notes}\nREJECT REASON: ${reason}` : `REJECT REASON: ${reason}`
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: remittance.propertyId,
          userId: ctx.userId,
          action: 'TAX_REMITTANCE_REJECTED',
          resource: 'TaxRemittance',
          resourceId: remittance.id,

          requestId: randomUUID(),
          newValue: { reason }
        }
      });

      return updated;
    });
  }
}
