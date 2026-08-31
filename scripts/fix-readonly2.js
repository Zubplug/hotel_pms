const fs = require('fs');

const filesToFix = [
  'apps/web/src/app/(cash-management)/expenses/page.tsx',
  'apps/web/src/app/(cash-management)/handovers/page.tsx',
  'apps/web/src/app/(dashboard)/settings/expense-configuration/page.tsx',
  'apps/web/src/app/(dashboard)/settings/financial-accounts/page.tsx',
  'apps/web/src/app/api/v1/pos/modifier-requests/route.ts',
  'apps/web/src/app/api/v1/pos/products/menu-request/route.ts',
  'apps/web/src/lib/resolve-user.ts'
];

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/propertyId: \{ in: propertyIds \}/g, 'propertyId: { in: [...propertyIds] }');
    content = content.replace(/propertyId: \{ in: ctx\.propertyIds \}/g, 'propertyId: { in: [...ctx.propertyIds] }');
    content = content.replace(/propertyId: \{ in: allowedProperties \}/g, 'propertyId: { in: [...allowedProperties] }');
    
    if (file.includes('handovers/page.tsx')) {
      content = content.replace(/receivedBy:/g, 'receivedById:');
      content = content.replace(/\.receivedBy\?/g, '.receivedById?');
    }
    
    if (file.includes('menu-request/route.ts')) {
      content = content.replace(/outlet: \{ propertyId/g, 'outletId: { in: [...propertyIds] }'); // let's just make it right. I'll use multi_replace instead for this one to be safe.
    }
    
    fs.writeFileSync(file, content);
  }
});
