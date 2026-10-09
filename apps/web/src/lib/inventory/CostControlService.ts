import prisma from "@hotel-pms/db";
import { calculateRecipeCost } from './recipe-costing';

export class CostControlService {
  /**
   * Dynamically calculates the theoretical cost (COGS) of a PosProduct
   * based on its active RecipeVersion and current StockItem MAC (Moving Average Cost).
   */
  static async getTheoreticalCost(posProductId: string) {
    const product = await prisma.posProduct.findUnique({
      where: { id: posProductId },
      include: {
        recipe: {
          include: {
            versions: {
              where: { isActive: true },
              include: {
                ingredients: {
                  include: { stockItem: { include: { stockUnits: true } } }
                }
              }
            }
          }
        },
        modifiers: { where: { isActive: true }, include: { stockItem: { select: { name: true, baseUnit: true, costPrice: true, stockUnits: true } } } }
      }
    });

    if (!product || !product.recipe || product.recipe.versions.length === 0) {
      return { cost: 0, margin: 0, ingredients: [] };
    }

    const costing = calculateRecipeCost(product.recipe, product.modifiers);
    const totalCost = costing.cost;

    const price = Number(product.price);
    const margin = price > 0 ? ((price - totalCost) / price) * 100 : 0;

    return {
      cost: totalCost,
      margin,
      targetMargin: Number(product.recipe.targetMargin),
      ingredients: costing.details
    };
  }
}
