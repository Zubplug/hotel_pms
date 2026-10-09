import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
const kitchenWarehouseId = 'ded1b0ad-a164-41d9-b0b1-a5c975011215';

// These are deliberately editable provisional operating assumptions.
// unitsInBase means how many base units are in one issue unit.
const packaging = [
  { stockName: 'Tin Milk', issueUnit: 'LITRE', unitsInBase: 6.25 }, // 1 tin = 160 ml
  { stockName: 'Juice', issueUnit: 'BOTTLE', unitsInBase: 1 }, // current menu treats one pack as one bottle
] as const;

const provisionalCosts = [
  { stockName: 'Semo', costPerBaseUnit: 1800 },
  { stockName: 'Corn Flour', costPerBaseUnit: 2200 },
  { stockName: 'Plantain Flour', costPerBaseUnit: 3000 },
  { stockName: 'Oat Meal', costPerBaseUnit: 5000 },
  { stockName: 'Dry Fish', costPerBaseUnit: 2500 },
] as const;

async function main() {
  const report: Array<Record<string, unknown>> = [];
  await prisma.$transaction(async tx => {
    for (const item of packaging) {
      const stocks = await tx.stockItem.findMany({ where: { propertyId, name: item.stockName, isActive: true, warehouseId: { not: kitchenWarehouseId } }, select: { id: true, name: true, baseUnit: true } });
      if (stocks.length === 0) throw new Error(`Missing stock item for ${item.stockName}`);
      for (const stock of stocks) {
        report.push({ action: apply ? 'UPSERT_CONVERSION' : 'WOULD_UPSERT_CONVERSION', stockItem: stock.name, baseUnit: stock.baseUnit, issueUnit: item.issueUnit, unitsInBase: item.unitsInBase, provisional: true });
        if (apply) {
          await tx.stockItemUnit.upsert({
            where: { stockItemId_unit: { stockItemId: stock.id, unit: item.issueUnit } },
            create: { stockItemId: stock.id, unit: item.issueUnit, unitsInBase: item.unitsInBase, isIssueUnit: true },
            update: { unitsInBase: item.unitsInBase, isIssueUnit: true },
          });
        }
      }
    }

    for (const item of provisionalCosts) {
      const stocks = await tx.stockItem.findMany({ where: { propertyId, warehouseId: kitchenWarehouseId, name: item.stockName, isActive: true }, select: { id: true, name: true, sku: true, costPrice: true } });
      for (const stock of stocks) {
        report.push({ action: apply ? 'SET_PROVISIONAL_COST' : 'WOULD_SET_PROVISIONAL_COST', stockItem: stock.name, from: Number(stock.costPrice), to: item.costPerBaseUnit, provisional: true });
        if (apply) {
          await tx.stockItem.update({ where: { id: stock.id }, data: { costPrice: item.costPerBaseUnit, sku: `KITCHEN-${item.stockName.toUpperCase().replace(/\s+/g, '-')}` } });
        }
      }
    }
  }, { timeout: 30000 });
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', report }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
