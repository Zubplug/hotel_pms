import { randomUUID } from 'crypto';
import { prisma, DepreciationMethod, AssetStatus, Prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';

export class FixedAssetService {
  static async listCategories(ctx: TenantContext, propertyId: string) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    return prisma.fixedAssetCategory.findMany({ where: { propertyId } });
  }

  static async createCategory(
    ctx: TenantContext,
    input: { propertyId: string; name: string; depreciationMethod: DepreciationMethod; usefulLifeYears: number; salvagePercent?: number; glAccountCode?: string; depreciationGlCode?: string; accumulatedGlCode?: string }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');
    return prisma.fixedAssetCategory.create({
      data: {
        ...input,
        salvagePercent: input.salvagePercent || 0
      }
    });
  }

  static async listAssets(ctx: TenantContext, propertyId: string, filters?: { categoryId?: string; status?: AssetStatus }) {
    if (!ctx.propertyIds.includes(propertyId)) throw new Error('Unauthorized');
    const where: Prisma.FixedAssetWhereInput = { propertyId, ...filters };
    return prisma.fixedAsset.findMany({
      where,
      include: { category: true },
      orderBy: { acquisitionDate: 'desc' }
    });
  }

  static async createAsset(
    ctx: TenantContext,
    input: { propertyId: string; categoryId: string; assetNumber: string; name: string; description?: string; location?: string; acquisitionDate: Date; acquisitionCost: number; salvageValue?: number; usefulLifeYears: number; depreciationMethod: DepreciationMethod; supplier?: string; invoiceRef?: string; warrantyExpiry?: Date }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) throw new Error('Unauthorized');

    return prisma.$transaction(async (tx) => {
      const asset = await tx.fixedAsset.create({
        data: {
          ...input,
          salvageValue: input.salvageValue || 0,
          currentBookValue: input.acquisitionCost,
          accumulatedDepreciation: 0,
          status: 'ACTIVE',
          createdBy: ctx.userId
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          userId: ctx.userId,
          action: 'FIXED_ASSET_CREATED',
          resource: 'FixedAsset',
          resourceId: asset.id,

          requestId: randomUUID(),
          newValue: { assetNumber: input.assetNumber, cost: input.acquisitionCost }
        }
      });

      return asset;
    });
  }

  static async updateAsset(ctx: TenantContext, assetId: string, updates: any) {
    const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    if (!ctx.propertyIds.includes(asset.propertyId)) throw new Error('Unauthorized');

    // Prevent changing acquisitionCost if depreciation has started
    if (Number(asset.accumulatedDepreciation) > 0 && updates.acquisitionCost && updates.acquisitionCost !== Number(asset.acquisitionCost)) {
      throw new Error('Cannot change acquisition cost after depreciation has been posted');
    }

    return prisma.fixedAsset.update({
      where: { id: assetId },
      data: updates
    });
  }

  static calculateMonthlyDepreciation(asset: { acquisitionCost: Prisma.Decimal; salvageValue: Prisma.Decimal; currentBookValue: Prisma.Decimal; usefulLifeYears: number; depreciationMethod: DepreciationMethod }) {
    const cost = Number(asset.acquisitionCost);
    const salvage = Number(asset.salvageValue);
    const current = Number(asset.currentBookValue);
    const years = asset.usefulLifeYears;

    if (current <= salvage) return 0; // Fully depreciated

    let charge = 0;
    if (asset.depreciationMethod === 'STRAIGHT_LINE') {
      charge = (cost - salvage) / (years * 12);
    } else if (asset.depreciationMethod === 'REDUCING_BALANCE') {
      // Typically, reducing balance rate is 1 - (salvage/cost)^(1/years). We will use a standard multiplier if not specified, e.g. 2 / years
      const rate = 2 / years;
      charge = (current * rate) / 12;
    }

    // Floor at salvage
    if (current - charge < salvage) {
      charge = current - salvage;
    }

    return charge;
  }

  /**
   * Called by AccountingPeriodService.close() to run depreciation for all active assets
   */
  static async runDepreciationForPeriod(ctx: TenantContext, tx: Prisma.TransactionClient, propertyId: string, periodId: string, depreciationDate: Date) {
    const assets = await tx.fixedAsset.findMany({
      where: { propertyId, status: 'ACTIVE' }
    });

    for (const asset of assets) {
      const charge = this.calculateMonthlyDepreciation(asset);
      if (charge <= 0) continue;

      const newBookValue = Number(asset.currentBookValue) - charge;
      const newAccumulated = Number(asset.accumulatedDepreciation) + charge;
      const status = newBookValue <= Number(asset.salvageValue) ? 'FULLY_DEPRECIATED' : 'ACTIVE';

      await tx.assetDepreciation.create({
        data: {
          assetId: asset.id,
          propertyId,
          periodId,
          depreciationDate,
          amount: charge,
          bookValueBefore: asset.currentBookValue,
          bookValueAfter: newBookValue,
          accumulatedAfter: newAccumulated,
          status: 'POSTED',
          postedBy: ctx.userId
        }
      });

      await tx.fixedAsset.update({
        where: { id: asset.id },
        data: {
          currentBookValue: newBookValue,
          accumulatedDepreciation: newAccumulated,
          status
        }
      });
    }
  }

  static async getDepreciationSchedule(ctx: TenantContext, assetId: string) {
    const asset = await prisma.fixedAsset.findUnique({
      where: { id: assetId },
      include: { depreciationSchedule: { orderBy: { depreciationDate: 'asc' } } }
    });
    if (!asset) throw new Error('Asset not found');
    if (!ctx.propertyIds.includes(asset.propertyId)) throw new Error('Unauthorized');
    return asset.depreciationSchedule;
  }

  static async recordDisposal(ctx: TenantContext, assetId: string, input: { disposalDate: Date; disposalAmount: number; disposalReason: string }) {
    const asset = await prisma.fixedAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');
    if (!ctx.propertyIds.includes(asset.propertyId)) throw new Error('Unauthorized');
    if (asset.status === 'DISPOSED') throw new Error('Asset already disposed');

    return prisma.$transaction(async (tx) => {
      const disposed = await tx.fixedAsset.update({
        where: { id: assetId },
        data: {
          status: 'DISPOSED',
          disposalDate: input.disposalDate,
          disposalAmount: input.disposalAmount,
          disposalReason: input.disposalReason
        }
      });

      const gainLoss = input.disposalAmount - Number(asset.currentBookValue);

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: asset.propertyId,
          userId: ctx.userId,
          action: 'FIXED_ASSET_DISPOSED',
          resource: 'FixedAsset',
          resourceId: asset.id,

          requestId: randomUUID(),
          newValue: { amount: input.disposalAmount, gainLoss }
        }
      });

      return disposed;
    });
  }
}
