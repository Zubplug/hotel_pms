import prisma from '@hotel-pms/db';
import * as fs from 'fs';
import * as path from 'path';

const PREPARED_FOOD_KEYWORDS = ['soup', 'rice', 'burger', 'combo', 'shawarma', 'fried', 'jollof', 'roast', 'meal', 'platter', 'salad', 'pasta', 'spaghetti', 'stew', 'suya'];
const SELLABLE_KEYWORDS = ['water', 'coke', 'beer', 'bottle', 'can', 'pack', 'sprite', 'fanta', 'guinness', 'malt', 'heineken', 'juice', 'wine', 'vodka', 'gin', 'whiskey', 'rum', 'tequila'];

async function main() {
  const stockItems = await prisma.stockItem.findMany({
    where: {
      posProductId: { not: null }
    },
    include: {
      posProduct: true,
      property: { select: { name: true } },
      warehouse: { select: { name: true } }
    }
  });

  console.log(`Found ${stockItems.length} StockItems with a linked posProductId.`);

  const sellables = [];
  const cookedFoods = [];
  const ambiguous = [];

  for (const item of stockItems) {
    const nameLower = item.name.toLowerCase();
    
    let isCooked = PREPARED_FOOD_KEYWORDS.some(kw => nameLower.includes(kw));
    let isSellable = SELLABLE_KEYWORDS.some(kw => nameLower.includes(kw));

    if (item.stockType === 'SELLABLE') {
      isSellable = true;
    }

    const reportRow = {
      id: item.id,
      name: item.name,
      stockType: item.stockType,
      posProductName: item.posProduct?.name || 'N/A',
      warehouse: item.warehouse?.name || 'Unknown',
      property: item.property?.name || 'Unknown',
      qty: item.quantityOnHand.toString()
    };

    if (isCooked && !isSellable) {
      cookedFoods.push(reportRow);
    } else if (isSellable && !isCooked) {
      sellables.push(reportRow);
    } else {
      ambiguous.push(reportRow);
    }
  }

  let markdown = `# Pre-Migration Classification Report\n\n`;
  markdown += `Total mappings found: **${stockItems.length}**\n\n`;

  markdown += `## A. Legitimate 1:1 Sellables (${sellables.length})\n`;
  markdown += `*Action: Will automatically create a 1-ingredient Recipe mapping the POS Product to this Stock Item.*\n\n`;
  markdown += `| Stock Item Name | POS Product Name | Stock Type | Warehouse | Qty |\n`;
  markdown += `|---|---|---|---|---|\n`;
  sellables.forEach(i => {
    markdown += `| ${i.name} | ${i.posProductName} | ${i.stockType} | ${i.warehouse} | ${i.qty} |\n`;
  });
  markdown += `\n`;

  markdown += `## B. Incorrect Cooked/Menu Items (${cookedFoods.length})\n`;
  markdown += `*Action: Will DETACH from inventory. F&B team must build proper recipes later.*\n\n`;
  markdown += `| Stock Item Name | POS Product Name | Stock Type | Warehouse | Qty |\n`;
  markdown += `|---|---|---|---|---|\n`;
  cookedFoods.forEach(i => {
    markdown += `| ${i.name} | ${i.posProductName} | ${i.stockType} | ${i.warehouse} | ${i.qty} |\n`;
  });
  markdown += `\n`;

  markdown += `## C. Ambiguous / Review Required (${ambiguous.length})\n`;
  markdown += `*Action: Please review these. If they are physical goods, they should be sellables. If cooked food, they should be detached.*\n\n`;
  markdown += `| Stock Item Name | POS Product Name | Stock Type | Warehouse | Qty |\n`;
  markdown += `|---|---|---|---|---|\n`;
  ambiguous.forEach(i => {
    markdown += `| ${i.name} | ${i.posProductName} | ${i.stockType} | ${i.warehouse} | ${i.qty} |\n`;
  });
  markdown += `\n`;

  const outPath = path.join(process.cwd(), 'audit_report.md');
  fs.writeFileSync(outPath, markdown);
  console.log(`Report generated at ${outPath}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
