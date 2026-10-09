import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const propertyId = '9b8a4229-4059-42f4-9565-51cfdbe79046';
const kitchenOutletId = '11add6e5-0e89-4351-aaa4-ec60059dc895';

type Rule = { stockName: string; portion: number; unit: string; category?: string };

const rules: Record<string, Rule> = {
  beef: { stockName: 'Raw Beef', portion: 0.25, unit: 'KG', category: 'Meat & Protein' },
  chicken: { stockName: 'Raw Chicken', portion: 1, unit: 'PIECE', category: 'Meat & Protein' },
  'goat meat': { stockName: 'Raw Goat Meat', portion: 0.25, unit: 'KG', category: 'Meat & Protein' },
  turkey: { stockName: 'Raw Turkey', portion: 0.25, unit: 'KG', category: 'Meat & Protein' },
  catfish: { stockName: 'Raw Catfish', portion: 0.25, unit: 'KG', category: 'Meat & Protein' },
  'catfish small': { stockName: 'Raw Catfish', portion: 0.25, unit: 'KG', category: 'Meat & Protein' },
  'catfish big': { stockName: 'Raw Catfish', portion: 0.4, unit: 'KG', category: 'Meat & Protein' },
  'croaker fish': { stockName: 'Raw Croaker Fish', portion: 0.4, unit: 'KG', category: 'Meat & Protein' },
  'dry fish': { stockName: 'Dry Fish', portion: 1, unit: 'PIECE' },
  'boiled egg': { stockName: 'Raw Egg', portion: 1, unit: 'PIECE', category: 'Meat & Protein' },
  'fried egg': { stockName: 'Raw Egg', portion: 1, unit: 'PIECE', category: 'Meat & Protein' },
  gizzard: { stockName: 'Gizzard', portion: 0.25, unit: 'KG', category: 'Meat & Protein' },
  snail: { stockName: 'Snail', portion: 1, unit: 'PIECE', category: 'Meat & Protein' },
  garri: { stockName: 'Garri', portion: 0.2, unit: 'KG', category: 'Grains & Starches' },
  poundo: { stockName: 'Poundo Flour', portion: 0.2, unit: 'KG', category: 'Grains & Starches' },
  semo: { stockName: 'Semo', portion: 0.2, unit: 'KG', category: 'Grains & Starches' },
  'corn flour': { stockName: 'Corn Flour', portion: 0.2, unit: 'KG', category: 'Grains & Starches' },
  'plantain flour': { stockName: 'Plantain Flour', portion: 0.2, unit: 'KG', category: 'Grains & Starches' },
  'oat meal': { stockName: 'Oat Meal', portion: 0.2, unit: 'KG', category: 'Grains & Starches' },
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function main() {
  const kitchenStocks = await prisma.stockItem.findMany({
    where: { propertyId, warehouse: { posOutletId: kitchenOutletId }, isActive: true },
    select: { id: true, name: true, baseUnit: true, costPrice: true, quantityOnHand: true, inventoryCategory: { select: { name: true } } },
  });
  const modifiers = await prisma.posProductModifier.findMany({
    where: { product: { propertyId }, isActive: true, groupName: { in: ['Choose Protein', 'Choose Swallow'] } },
    select: { id: true, name: true, groupName: true, stockItemId: true, quantity: true, unitOfMeasure: true, product: { select: { name: true } } },
  });
  const report = { mode: apply ? 'APPLY' : 'DRY_RUN', updated: 0, unmapped: [] as string[], missingStockDefinitions: [] as string[] };
  const missing = new Set<string>();
  const pendingUpdates: Array<{ id: string; stockItemId: string; quantity: number; unitOfMeasure: string }> = [];

  for (const modifier of modifiers) {
    const rule = rules[normalize(modifier.name)];
    if (!rule) {
      missing.add(modifier.name);
      report.unmapped.push(`${modifier.product.name} / ${modifier.groupName} / ${modifier.name}`);
      continue;
    }
    const candidates = kitchenStocks.filter(stock => normalize(stock.name) === normalize(rule.stockName) && (!rule.category || stock.inventoryCategory?.name === rule.category));
    if (candidates.length !== 1) {
      report.unmapped.push(`${modifier.product.name} / ${modifier.groupName} / ${modifier.name}: ${candidates.length} kitchen stock matches for ${rule.stockName}`);
      continue;
    }
    const stock = candidates[0];
    if (stock.baseUnit !== rule.unit) {
      report.unmapped.push(`${modifier.product.name} / ${modifier.name}: ${rule.stockName} base unit is ${stock.baseUnit}, expected ${rule.unit}`);
      continue;
    }
    report.updated++;
    if (apply) pendingUpdates.push({ id: modifier.id, stockItemId: stock.id, quantity: rule.portion, unitOfMeasure: rule.unit });
  }
  if (apply) {
    const batches = new Map<string, typeof pendingUpdates>();
    for (const update of pendingUpdates) {
      const batchKey = `${update.stockItemId}:${update.quantity}:${update.unitOfMeasure}`;
      batches.set(batchKey, [...(batches.get(batchKey) || []), update]);
    }
    for (const batch of batches.values()) await prisma.posProductModifier.updateMany({ where: { id: { in: batch.map(update => update.id) } }, data: { stockItemId: batch[0].stockItemId, quantity: batch[0].quantity, unitOfMeasure: batch[0].unitOfMeasure as any, groupRequired: true, groupMaxSelect: 1 } });
  }
  report.missingStockDefinitions = [...missing].sort();
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
