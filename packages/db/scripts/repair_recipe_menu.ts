import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

function key(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function main() {
  const properties = await prisma.property.findMany({ where: { isActive: true }, select: { id: true, name: true, settings: true } });
  const report = { properties: properties.length, modifiersNormalized: 0, modifiersLinked: 0, ambiguousLinks: 0, poolPassesConverted: 0, skipped: [] as string[] };

  for (const property of properties) {
    const stockItems = await prisma.stockItem.findMany({ where: { propertyId: property.id, isActive: true }, select: { id: true, name: true, baseUnit: true, warehouseId: true, warehouse: { select: { posOutletId: true } } } });
    const byName = new Map<string, typeof stockItems>();
    for (const stock of stockItems) byName.set(key(stock.name), [...(byName.get(key(stock.name)) || []), stock]);

    const modifiers = await prisma.posProductModifier.findMany({ where: { product: { propertyId: property.id }, isActive: true }, select: { id: true, name: true, groupName: true, groupRequired: true, groupMaxSelect: true, stockItemId: true, unitOfMeasure: true, product: { select: { name: true } } } });
    for (const modifier of modifiers) {
      const prefixedProtein = /^protein\s*:\s*/i.test(modifier.name);
      const normalizedName = prefixedProtein ? modifier.name.replace(/^protein\s*:\s*/i, '').trim() : modifier.name.trim();
      const normalizedGroup = prefixedProtein || key(modifier.groupName || '') === 'choose protein' ? 'Choose Protein' : key(modifier.groupName || '') === 'choose shallow' ? 'Choose Swallow' : modifier.groupName;
      const candidates = byName.get(key(normalizedName)) || [];
      const update: Record<string, unknown> = {};
      if (prefixedProtein && normalizedName !== modifier.name) update.name = normalizedName;
      if (normalizedGroup !== modifier.groupName) update.groupName = normalizedGroup || null;
      if (normalizedGroup === 'Choose Protein' || normalizedGroup === 'Choose Swallow') {
        if (modifier.groupRequired !== true) update.groupRequired = true;
        if (modifier.groupMaxSelect !== 1) update.groupMaxSelect = 1;
      }
      if (!modifier.stockItemId && candidates.length === 1) {
        update.stockItemId = candidates[0].id;
        update.unitOfMeasure = candidates[0].baseUnit;
        report.modifiersLinked++;
      } else if (!modifier.stockItemId && candidates.length > 1) {
        report.ambiguousLinks++;
        report.skipped.push(`${property.name}: ${modifier.product.name} / ${modifier.name} has ${candidates.length} stock matches`);
      }
      if (Object.keys(update).length) {
        report.modifiersNormalized++;
        if (apply) await prisma.posProductModifier.update({ where: { id: modifier.id }, data: update });
      }
    }

    const poolPasses = await prisma.posProduct.findMany({ where: { propertyId: property.id, isActive: true, category: { name: { equals: 'Pool Passes', mode: 'insensitive' } }, inventoryMode: 'STOCK' }, select: { id: true, name: true } });
    report.poolPassesConverted += poolPasses.length;
    if (apply && poolPasses.length) await prisma.posProduct.updateMany({ where: { id: { in: poolPasses.map(item => item.id) } }, data: { inventoryMode: 'NON_STOCK' } });
  }

  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY_RUN', ...report }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
