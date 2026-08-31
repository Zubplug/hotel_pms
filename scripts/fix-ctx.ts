import * as fs from 'fs';
import * as glob from 'glob';

const files = [
  'apps/web/src/app/api/v1/inventory/purchase-orders/route.ts',
  'apps/web/src/app/api/v1/inventory/purchase-orders/[id]/route.ts',
  'apps/web/src/app/api/v1/inventory/stock-items/[id]/route.ts',
  'apps/web/src/app/api/v1/inventory/stock-items/route.ts',
  'apps/web/src/app/api/v1/inventory/stocktakes/[id]/route.ts',
  'apps/web/src/app/api/v1/inventory/stocktakes/route.ts',
  'apps/web/src/app/api/v1/inventory/suppliers/[id]/route.ts',
  'apps/web/src/app/api/v1/inventory/suppliers/route.ts',
  'apps/web/src/app/api/v1/inventory/transfers/route.ts',
  'apps/web/src/app/api/v1/inventory/warehouses/[id]/route.ts',
  'apps/web/src/app/api/v1/inventory/warehouses/route.ts'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let changed = false;

    // Add ctx to POST or PUT if it uses session.user but missing ctx
    content = content.replace(/const\s*{\s*role[^;]*session\.user\s+as\s+any\s*;/g, (match) => {
        if (!content.includes('const ctx = await requireOrganizationContext')) {
            changed = true;
            return `${match}\n    const ctx = await requireOrganizationContext(session.user.id);`;
        }
        // If it's already in the file (e.g. GET has it), check if the function block has it
        // A naive replace: just add it right after destructuring
        changed = true;
        return `${match}\n    const ctx = await requireOrganizationContext(session.user.id);`;
    });

    if (changed) {
        fs.writeFileSync(file, content);
        console.log(`Fixed ${file}`);
    }
}

// For recipes
const recipesRoute = 'apps/web/src/app/api/v1/inventory/recipes/route.ts';
let recipesContent = fs.readFileSync(recipesRoute, 'utf-8');
recipesContent = recipesContent.replace(/if \('response' in context\) return context\.response;/g, (match) => {
    return `${match}\n  const ctx = context.ctx!;`;
});
fs.writeFileSync(recipesRoute, recipesContent);
