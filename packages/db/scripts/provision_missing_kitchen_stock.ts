import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
const kitchenWarehouseId = 'ded1b0ad-a164-41d9-b0b1-a5c975011215';
const mainWarehouseId = '7f80eb4e-49df-42ec-b661-2d6ec90f04ff';
const definitions = [
  { name: 'Semo', baseUnit: 'KG', category: 'Grains & Starches', cost: 0, sku: 'KITCHEN-PENDING-COST-SEMO' },
  { name: 'Corn Flour', baseUnit: 'KG', category: 'Grains & Starches', cost: 0, sku: 'KITCHEN-PENDING-COST-CORN-FLOUR' },
  { name: 'Plantain Flour', baseUnit: 'KG', category: 'Grains & Starches', cost: 0, sku: 'KITCHEN-PENDING-COST-PLANTAIN-FLOUR' },
  { name: 'Oat Meal', baseUnit: 'KG', category: 'Grains & Starches', cost: 0, sku: 'KITCHEN-PENDING-COST-OAT-MEAL' },
  { name: 'Gizzard', baseUnit: 'KG', category: 'Meat & Protein', cost: 7000, sku: 'KITCHEN-GIZZARD' },
  { name: 'Snail', baseUnit: 'PIECE', category: 'Meat & Protein', cost: 3500, sku: 'KITCHEN-SNAIL' },
] as const;

async function main() {
  const categories = await prisma.inventoryCategory.findMany({ where: { propertyId, name: { in: definitions.map(item => item.category) } }, select: { id: true, name: true } });
  const categoryByName = new Map(categories.map(category => [category.name, category.id]));
  const report: Array<Record<string, unknown>> = [];
  for (const definition of definitions) {
    const existing = await prisma.stockItem.findFirst({ where: { propertyId, warehouseId: kitchenWarehouseId, name: definition.name, isActive: true }, select: { id: true, costPrice: true } });
    if (existing) { report.push({ name: definition.name, action: 'EXISTS', id: existing.id, cost: String(existing.costPrice) }); continue; }
    const source = await prisma.stockItem.findFirst({ where: { propertyId, warehouseId: mainWarehouseId, name: definition.name, isActive: true }, select: { costPrice: true } });
    const cost = source ? Number(source.costPrice) : definition.cost;
    report.push({ name: definition.name, action: apply ? 'CREATED' : 'WOULD_CREATE', baseUnit: definition.baseUnit, cost, costPending: cost <= 0 });
    if (apply) await prisma.stockItem.create({ data: { propertyId, warehouseId: kitchenWarehouseId, name: definition.name, sku: definition.sku, baseUnit: definition.baseUnit as any, stockType: 'RAW_MATERIAL', costPrice: cost, quantityOnHand: 0, categoryId: categoryByName.get(definition.category) || null, isActive: true } });
  }
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', report }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
