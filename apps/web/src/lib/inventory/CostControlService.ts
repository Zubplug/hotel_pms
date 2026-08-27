import prisma from "@hotel-pms/db";
import { UnitOfMeasure } from "@hotel-pms/db";

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
                  include: { stockItem: true }
                }
              }
            }
          }
        }
      }
    });

    if (!product || !product.recipe || product.recipe.versions.length === 0) {
      return { cost: 0, margin: 0, ingredients: [] };
    }

    const activeVersion = product.recipe.versions[0];
    let totalCost = 0;

    const conversions = await prisma.unitOfMeasureConversion.findMany({
      where: { propertyId: product.recipe.propertyId }
    });

    const getConversionRatio = (from: UnitOfMeasure, to: UnitOfMeasure) => {
      if (from === to) return 1;
      const conv = conversions.find(c => c.fromUnit === from && c.toUnit === to);
      if (conv) return Number(conv.ratio);
      
      const inv = conversions.find(c => c.toUnit === from && c.fromUnit === to);
      if (inv) return 1 / Number(inv.ratio);
      
      throw new Error(`Missing UOM conversion from ${from} to ${to}`);
    };

    const ingredientDetails = [];

    for (const ingredient of activeVersion.ingredients) {
      const stockItem = ingredient.stockItem;
      const recipeUOM = ingredient.unitOfMeasure;
      const stockUOM = stockItem.unitOfMeasure; // assuming StockItem has unitOfMeasure

      const ratio = getConversionRatio(recipeUOM, stockUOM);
      
      // StockItem cost is per stockUOM.
      // So the cost of the recipe ingredient is: (ingredientQty * ratio) * stockItem.costPrice
      const consumedStockUnits = Number(ingredient.quantity) * ratio;
      const ingredientCost = consumedStockUnits * Number(stockItem.costPrice);
      
      totalCost += ingredientCost;
      
      ingredientDetails.push({
        id: ingredient.id,
        stockItemName: stockItem.name,
        recipeQty: Number(ingredient.quantity),
        recipeUOM,
        stockUOM,
        consumedStockUnits,
        stockCostPrice: Number(stockItem.costPrice),
        ingredientCost
      });
    }

    const price = Number(product.price);
    const margin = price > 0 ? ((price - totalCost) / price) * 100 : 0;

    return {
      cost: totalCost,
      margin,
      targetMargin: Number(product.recipe.targetMargin),
      ingredients: ingredientDetails
    };
  }
}
