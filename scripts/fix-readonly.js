const fs = require('fs');

const filesToFix = [
  'apps/web/src/app/(cash-management)/handovers/page.tsx',
  'apps/web/src/app/(dashboard)/settings/expense-configuration/page.tsx',
  'apps/web/src/app/(dashboard)/settings/financial-accounts/page.tsx',
  'apps/web/src/app/api/v1/pos/modifier-requests/route.ts',
  'apps/web/src/app/api/v1/properties/route.ts',
  'apps/web/src/app/api/v1/rooms/route.ts',
  'apps/web/src/lib/resolve-user.ts',
  'apps/web/src/app/api/v1/pos/products/menu-request/route.ts'
];

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/propertyId: \{ in: allowedPropertyIds \}/g, 'propertyId: { in: [...allowedPropertyIds] }');
    content = content.replace(/propertyId: \{ in: allowedProperties \}/g, 'propertyId: { in: [...allowedProperties] }');
    content = content.replace(/propertyId: \{ in: ctx\.propertyIds \}/g, 'propertyId: { in: [...ctx.propertyIds] }');
    content = content.replace(/propertyId: \{ in: allowed \}/g, 'propertyId: { in: [...allowed] }');
    content = content.replace(/id: \{ in: allowed \}/g, 'id: { in: [...allowed] }');
    content = content.replace(/propertyId: \{ in: await requireOrganizationContext/g, 'propertyId: { in: [...(await requireOrganizationContext');
    content = content.replace(/propertyId: \{ in: \[\.\.\.\(await requireOrganizationContext\(user\.id\)\)\.propertyIds\] \}/g, 'propertyId: { in: [...(await requireOrganizationContext(user.id)).propertyIds] }'); // handle the script mistake
    content = content.replace(/propertyId: \{ in: await requireOrganizationContext\(user\.id\)\.propertyIds \}/g, 'propertyId: { in: [...(await requireOrganizationContext(user.id)).propertyIds] }');

    
    if (file.includes('handovers/page.tsx')) {
      content = content.replace(/receivedBy: /g, 'receivedById: ');
    }
    
    if (file.includes('menu-request/route.ts')) {
      content = content.replace(/outlet: \{ propertyId/g, 'outlet: { propertyId'); // wait, Prisma expects outletId or outlet: { propertyId } ? It's probably expecting outlet: { propertyId } for filtering if there is a relation.
      // Ah, TS says: "Property 'outlet' does not exist on type 'PosCategory'. Did you mean 'outletId'?"
      // So the include was missing? Or relation changed?
    }
    
    if (file.includes('resolve-user.ts')) {
      content = content.replace(/allowedProperties: mobileSession\.allowedProperties \?\? \(mobileSession\.propertyId \? \[mobileSession\.propertyId\] : \[\]\),/g, 'allowedProperties: [...(mobileSession.allowedProperties ?? (mobileSession.propertyId ? [mobileSession.propertyId] : []))],');
    }
    
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
});
