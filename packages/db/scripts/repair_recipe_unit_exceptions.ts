import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
const kitchenWarehouseId = 'ded1b0ad-a164-41d9-b0b1-a5c975011215';

const kitchenKgIngredients = new Set(['raw spaghetti', 'stockfish', 'raw yam', 'waterleaf']);
const oneToOneBottleIngredients = new Set(['origin bitters (pet)', 'hollandia']);

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function main() {
  const kitchenStock = await prisma.stockItem.findMany({
    where: { propertyId, warehouseId: kitchenWarehouseId, isActive: true, baseUnit: 'KG' },
    select: { id: true, name: true, baseUnit: true },
  });
  const kitchenByName = new Map(kitchenStock.map(item => [normalize(item.name), item]));
  const ingredients = await prisma.recipeIngredient.findMany({
    where: { recipeVersion: { isActive: true, recipe: { propertyId, isActive: true, posProduct: { OR: [{ productionStation: 'KITCHEN' }, { productionStation: null, category: { productionStation: 'KITCHEN' } }] } } } },
    include: { stockItem: true, recipeVersion: { include: { recipe: { include: { posProduct: { select: { name: true } } } } } } },
  });
  const report: Array<Record<string, unknown>> = [];

  await prisma.$transaction(async tx => {
    for (const ingredient of ingredients) {
      const name = normalize(ingredient.stockItem.name);
      const replacement = kitchenKgIngredients.has(name) ? kitchenByName.get(name) : undefined;
      if (replacement) {
        report.push({ action: apply ? 'REMAP_KITCHEN_STOCK' : 'WOULD_REMAP_KITCHEN_STOCK', product: ingredient.recipeVersion.recipe.posProduct.name, ingredient: ingredient.stockItem.name, from: ingredient.stockItem.id, to: replacement.id, unit: replacement.baseUnit });
        if (apply) await tx.recipeIngredient.update({ where: { id: ingredient.id }, data: { stockItemId: replacement.id, unitOfMeasure: 'KG' } });
        continue;
      }

      if (oneToOneBottleIngredients.has(name) && ingredient.unitOfMeasure === 'BOTTLE' && ingredient.stockItem.baseUnit === 'PIECE') {
        report.push({ action: apply ? 'ADD_ONE_TO_ONE_BOTTLE_CONVERSION' : 'WOULD_ADD_ONE_TO_ONE_BOTTLE_CONVERSION', ingredient: ingredient.stockItem.name, stockItemId: ingredient.stockItem.id });
        if (apply) {
          await tx.stockItemUnit.upsert({
            where: { stockItemId_unit: { stockItemId: ingredient.stockItem.id, unit: 'BOTTLE' } },
            create: { stockItemId: ingredient.stockItem.id, unit: 'BOTTLE', unitsInBase: 1, isIssueUnit: true },
            update: { unitsInBase: 1, isIssueUnit: true },
          });
        }
      }
    }

    const mineral = await tx.recipeIngredient.findMany({
      where: { recipeVersion: { isActive: true, recipe: { propertyId, isActive: true, posProduct: { name: 'Mineral' } } }, stockItem: { name: 'Mineral' }, unitOfMeasure: 'UNIT' },
      select: { id: true, stockItem: { select: { baseUnit: true } } },
    });
    for (const item of mineral) {
      if (item.stockItem.baseUnit === 'BOTTLE') {
        report.push({ action: apply ? 'NORMALIZE_UNIT' : 'WOULD_NORMALIZE_UNIT', product: 'Mineral', from: 'UNIT', to: 'BOTTLE' });
        if (apply) await tx.recipeIngredient.update({ where: { id: item.id }, data: { unitOfMeasure: 'BOTTLE' } });
      }
    }

    const barBottleRecipes = await tx.recipeIngredient.findMany({
      where: {
        recipeVersion: { isActive: true, recipe: { propertyId, isActive: true, posProduct: { OR: [{ productionStation: 'BAR' }, { productionStation: null, category: { productionStation: 'BAR' } }] } } },
        unitOfMeasure: 'BOTTLE',
        stockItem: { baseUnit: 'PIECE', name: { in: ['Origin Bitters (Pet)', 'Hollandia'] } },
      },
      select: { stockItemId: true, stockItem: { select: { name: true } } },
    });
    for (const item of barBottleRecipes) {
      report.push({ action: apply ? 'ADD_ONE_TO_ONE_BOTTLE_CONVERSION' : 'WOULD_ADD_ONE_TO_ONE_BOTTLE_CONVERSION', ingredient: item.stockItem.name, stockItemId: item.stockItemId });
      if (apply) {
        await tx.stockItemUnit.upsert({
          where: { stockItemId_unit: { stockItemId: item.stockItemId, unit: 'BOTTLE' } },
          create: { stockItemId: item.stockItemId, unit: 'BOTTLE', unitsInBase: 1, isIssueUnit: true },
          update: { unitsInBase: 1, isIssueUnit: true },
        });
      }
    }
  }, { timeout: 30000 });

  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', changes: report.length, report }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
