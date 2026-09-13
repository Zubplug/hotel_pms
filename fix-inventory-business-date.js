const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps/web/src/lib/inventory/InventoryService.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix postReceipt
content = content.replace(
  /const property = await tx\.property\.findUnique\(\{ where: \{ id: grn\.propertyId \} \}\);\s+const currency = property\?\.baseCurrency \|\| 'NGN';/g,
  `const property = await tx.property.findUnique({ where: { id: grn.propertyId } });
      if (!property?.businessDate) throw new Error('Property business date is not initialized. Cannot post receipt.');
      const currency = property?.baseCurrency || 'NGN';`
);

content = content.replace(
  /businessDate: property\?\.businessDate \|\| new Date\(\)/g,
  `businessDate: property.businessDate`
);

// Fix postTransfer
content = content.replace(
  /const sourceItems = await tx\.stockItem\.findMany/g,
  `const property = await tx.property.findUnique({ where: { id: transfer.propertyId } });
      if (!property?.businessDate) throw new Error('Property business date is not initialized. Cannot post transfer.');
      
      const sourceItems = await tx.stockItem.findMany`
);

// In postTransfer, there are two businessDate: new Date()
// We only want to replace them inside postTransfer.
// Actually, let's just replace all remaining businessDate: new Date() with businessDate: property.businessDate in the file where property is available?
// Wait, costAdjustment also needs property
content = content.replace(
  /const property = await tx\.property\.findUnique\(\{ where: \{ id: adjustment\.propertyId \} \}\);\s+const currency = property\?\.baseCurrency \|\| 'NGN';/g,
  `const property = await tx.property.findUnique({ where: { id: adjustment.propertyId } });
      if (!property?.businessDate) throw new Error('Property business date is not initialized. Cannot post adjustment.');
      const currency = property?.baseCurrency || 'NGN';`
);

// Now safely replace businessDate: new Date() with businessDate: property.businessDate, inside stockTransaction.create
content = content.replace(/businessDate:\s*new Date\(\)/g, 'businessDate: property.businessDate');

fs.writeFileSync(filePath, content);
console.log('Fixed businessDate in InventoryService.ts');
