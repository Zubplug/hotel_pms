import { Project, SyntaxKind, ObjectBindingPattern } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('apps/web/src/app/api/v1/inventory/**/*.ts');

for (const file of sourceFiles) {
  let changed = false;

  // 1. Add import for requireOrganizationContext
  const hasImport = file.getImportDeclaration(dec => dec.getModuleSpecifierValue() === '@/lib/organization-access');
  if (!hasImport) {
    file.addImportDeclaration({
      moduleSpecifier: '@/lib/organization-access',
      namedImports: ['requireOrganizationContext']
    });
    changed = true;
  }

  // 2. Add TenantContext to session.user destructuring
  const varDecs = file.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const dec of varDecs) {
    const init = dec.getInitializer();
    if (init && init.getText().includes('session.user')) {
      const nameNode = dec.getNameNode();
      if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
        
        const currentText = nameNode.getText();
        if (currentText.includes('propertyId')) {
           const newText = currentText.replace(/,\s*propertyId/, '').replace(/propertyId\s*,/, '').replace(/propertyId/, '').replace(/{\s*}/, '{}');
           nameNode.replaceWithText(newText);
           changed = true;
        }
        
        // Insert ctx initialization
        const parentList = dec.getParentIfKind(SyntaxKind.VariableDeclarationList);
        if (parentList) {
          const stmt = parentList.getParentIfKind(SyntaxKind.VariableStatement);
          if (stmt) {
            const block = stmt.getParentIfKind(SyntaxKind.Block);
            if (block) {
              const idx = stmt.getChildIndex() + 1;
              block.insertStatements(idx, `const ctx = await requireOrganizationContext(session.user.id);`);
              changed = true;
            }
          }
        }
      }
    }
  }

  // Replace text
  let text = file.getFullText();
  let textChanged = false;
  if (text.match(/where:\s*{\s*propertyId\s*}/)) {
     text = text.replace(/where:\s*{\s*propertyId\s*}/g, 'where: { propertyId: { in: ctx.propertyIds } }');
     textChanged = true;
  }
  if (text.includes('propertyId, isActive')) {
     text = text.replace(/propertyId\s*,\s*isActive/g, 'propertyId: { in: ctx.propertyIds }, isActive');
     textChanged = true;
  }
  // Also for InventoryService methods: e.g. postReceipt(grnId, ... -> postReceipt(ctx, grnId, ...)
  if (text.includes('InventoryService.postReceipt(') && !text.includes('InventoryService.postReceipt(ctx')) {
     text = text.replace(/InventoryService\.postReceipt\(/g, 'InventoryService.postReceipt(ctx, ');
     textChanged = true;
  }
  if (text.includes('InventoryService.postTransfer(') && !text.includes('InventoryService.postTransfer(ctx')) {
     text = text.replace(/InventoryService\.postTransfer\(/g, 'InventoryService.postTransfer(ctx, ');
     textChanged = true;
  }

  if (textChanged) {
     file.replaceWithText(text);
     changed = true;
  }

  if (changed) {
    file.saveSync();
    console.log(`Updated ${file.getFilePath()}`);
  }
}
