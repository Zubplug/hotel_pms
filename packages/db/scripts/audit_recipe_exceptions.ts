import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sameUnit(left: string, right: string) {
  const aliases = new Set(['UNIT', 'EACH', 'PIECE']);
  return left === right || (aliases.has(left) && aliases.has(right));
}

async function main() {
  const properties = await prisma.property.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const output: Array<Record<string, unknown>> = [];

  for (const property of properties) {
    const stockByName = new Map<string, Array<{ warehouse: string | null; baseUnit: string; cost: number; quantity: number }>>();
    const allStock = await prisma.stockItem.findMany({
      where: { propertyId: property.id, isActive: true },
      select: { name: true, baseUnit: true, costPrice: true, quantityOnHand: true, warehouse: { select: { name: true } } },
    });
    for (const stock of allStock) {
      const key = stock.name.trim().toLowerCase();
      stockByName.set(key, [...(stockByName.get(key) || []), { warehouse: stock.warehouse?.name || null, baseUnit: stock.baseUnit, cost: Number(stock.costPrice), quantity: Number(stock.quantityOnHand) }]);
    }
    const recipes = await prisma.recipe.findMany({
      where: { posProduct: { propertyId: property.id }, isActive: true },
      include: {
        posProduct: { select: { name: true, productionStation: true, category: { select: { name: true, productionStation: true } } } },
        versions: { where: { isActive: true }, include: { ingredients: { include: { stockItem: { include: { stockUnits: true, warehouse: { select: { name: true } } } } } } } },
      },
    });
    for (const recipe of recipes) {
      for (const version of recipe.versions) {
        for (const ingredient of version.ingredients) {
          const item = ingredient.stockItem;
          const unit = ingredient.unitOfMeasure;
          const multiplier = sameUnit(unit, item.baseUnit)
            ? 1
            : Number(item.stockUnits.find(candidate => candidate.unit === unit)?.unitsInBase || 0);
          if (Number(item.costPrice) <= 0 || multiplier <= 0) {
            output.push({
              property: property.name,
              product: recipe.posProduct.name,
              kind: 'INGREDIENT',
              name: item.name,
              stockId: item.id,
              warehouse: item.warehouse?.name,
              baseUnit: item.baseUnit,
              issueUnit: unit,
              quantity: Number(ingredient.quantity),
              productionStation: recipe.posProduct.productionStation || recipe.posProduct.category?.productionStation,
              category: recipe.posProduct.category?.name,
              cost: Number(item.costPrice),
              configuredConversions: item.stockUnits.map(candidate => ({ unit: candidate.unit, unitsInBase: Number(candidate.unitsInBase) })),
              availableDefinitions: stockByName.get(item.name.trim().toLowerCase()) || [],
              reason: Number(item.costPrice) <= 0 ? 'COST_PENDING' : 'CONVERSION_MISSING',
            });
          }
        }
      }
    }
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
