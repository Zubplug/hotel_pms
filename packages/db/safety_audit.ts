import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const PREPARED_FOOD_KEYWORDS = ['soup', 'rice', 'burger', 'combo', 'shawarma', 'fried', 'jollof', 'roast', 'meal', 'platter', 'salad', 'pasta', 'spaghetti', 'stew', 'suya', 'chips'];
const SELLABLE_KEYWORDS = ['water', 'coke', 'beer', 'bottle', 'can', 'pack', 'sprite', 'fanta', 'guinness', 'malt', 'heineken', 'juice', 'wine', 'vodka', 'gin', 'whiskey', 'rum', 'tequila', 'mineral'];

async function main() {
  const stockItems = await prisma.stockItem.findMany({
    where: {
      posProductId: { not: null }
    },
    include: {
      posProduct: {
        include: { recipe: true }
      },
      property: { select: { id: true, name: true, organizationId: true } },
      warehouse: { select: { id: true, name: true } },
      _count: {
        select: { transactions: true }
      }
    }
  });

  let markdown = `# Phase 1.5: Deep Dependency Safety Audit\n\n`;
  markdown += `Total mappings to audit: **${stockItems.length}**\n\n`;

  let validCount = 0;
  let cookedCount = 0;
  let ambiguousCount = 0;

  for (let i = 0; i < stockItems.length; i++) {
    const item = stockItems[i];
    const nameLower = item.name.toLowerCase();
    
    let isCooked = PREPARED_FOOD_KEYWORDS.some(kw => nameLower.includes(kw));
    let isSellable = SELLABLE_KEYWORDS.some(kw => nameLower.includes(kw));

    if (item.stockType === 'SELLABLE') {
      isSellable = true;
    }

    let classification = '';
    let action = '';

    // Fix the classification logic as requested: priority on name semantics
    if (PREPARED_FOOD_KEYWORDS.some(kw => nameLower.includes(kw))) {
      classification = 'Cooked Food (Fake Stock)';
      action = 'DETACH & RETIRE';
      cookedCount++;
    } else if (SELLABLE_KEYWORDS.some(kw => nameLower.includes(kw))) {
      classification = 'Legitimate 1:1 Sellable';
      action = 'CONVERT TO RECIPE';
      validCount++;
    } else {
      classification = 'Ambiguous';
      action = 'REVIEW REQUIRED';
      ambiguousCount++;
    }

    const txCount = item._count.transactions;
    const hasRecipe = item.posProduct?.recipe ? 'YES' : 'NO';
    const canSafelyDelete = txCount === 0 ? 'YES' : 'NO (Must Retire)';
    
    let finalAction = '';
    if (action === 'DETACH & RETIRE') {
      finalAction = canSafelyDelete === 'YES' ? 'DELETE StockItem' : 'RETIRE (isActive=false, posProductId=null)';
    } else if (action === 'CONVERT TO RECIPE') {
      finalAction = hasRecipe === 'YES' ? 'CONFLICT (Recipe already exists)' : 'CREATE 1-Ingredient Recipe';
    } else {
      finalAction = 'PENDING REVIEW';
    }

    markdown += `### Record ${i + 1}: ${item.name}\n`;
    markdown += `- **StockItem ID:** \`${item.id}\`\n`;
    markdown += `- **POS Product ID:** \`${item.posProductId}\`\n`;
    markdown += `- **POS Product Name:** ${item.posProduct?.name || 'N/A'}\n`;
    markdown += `- **Organization ID:** \`${item.property?.organizationId}\`\n`;
    markdown += `- **Property ID:** \`${item.property?.id}\` (${item.property?.name})\n`;
    markdown += `- **Warehouse:** \`${item.warehouse?.id}\` (${item.warehouse?.name})\n`;
    markdown += `- **Current Qty:** ${item.quantityOnHand.toString()}\n`;
    markdown += `- **Stock Classification:** ${classification}\n`;
    markdown += `- **Existing Recipe:** ${hasRecipe}\n`;
    markdown += `- **Historical Transactions:** ${txCount}\n`;
    markdown += `- **Can Safely Delete?** ${canSafelyDelete}\n`;
    markdown += `- **Migration Action:** **${finalAction}**\n\n`;
  }

  markdown += `---\n`;
  markdown += `### Summary Status\n`;
  markdown += `- **Legitimate Sellables:** ${validCount}\n`;
  markdown += `- **Cooked Foods:** ${cookedCount}\n`;
  markdown += `- **Ambiguous:** ${ambiguousCount}\n\n`;

  const outPath = path.join(process.cwd(), '../../dependency_audit_report.md');
  fs.writeFileSync(outPath, markdown);
  console.log(`Report generated at ${outPath}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
