import { Project, SyntaxKind, ObjectLiteralExpression } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('apps/web/src/app/api/v1/inventory/**/*.ts');

for (const file of sourceFiles) {
  let changed = false;
  let text = file.getFullText();

  // Fix readonly string[] issue
  if (text.includes('in: ctx.propertyIds }')) {
     text = text.replace(/in:\s*ctx\.propertyIds\s*}/g, 'in: ctx.propertyIds as string[] }');
     changed = true;
  }
  
  if (text.includes('ctx.propertyIds as string[] as string[]')) {
     text = text.replace(/ctx\.propertyIds as string\[\] as string\[\]/g, 'ctx.propertyIds as string[]');
  }

  // Fix shorthand propertyId
  // This usually occurs in `data: { propertyId, ... }`
  // We can replace `propertyId,` with `propertyId: reqPropertyId || ctx.propertyIds[0],`
  // And `propertyId }` with `propertyId: reqPropertyId || ctx.propertyIds[0] }`
  // Only if they are shorthand! Regex is dangerous for this, but since it's isolated:
  if (text.match(/[\s,{]propertyId\s*[,}]/)) {
     // A safer way is to use TS Morph to find shorthand property assignments
     file.replaceWithText(text);
     text = file.getFullText(); // refresh
     const shorthands = file.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment);
     for (const sh of shorthands) {
         if (sh.getName() === 'propertyId') {
             // check if reqPropertyId exists in scope. If not, use ctx.propertyIds[0]
             const hasReqProp = file.getFullText().includes('reqPropertyId');
             sh.replaceWithText(`propertyId: ${hasReqProp ? '(reqPropertyId || ctx.propertyIds[0])' : 'ctx.propertyIds[0]'}`);
             changed = true;
         }
     }
  } else if (changed) {
     file.replaceWithText(text);
  }

  // Fix redeclared ctx
  const varDecs = file.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  let ctxCount = 0;
  for (const dec of varDecs) {
      if (dec.getName() === 'ctx') {
          ctxCount++;
          if (ctxCount > 1) {
              const stmt = dec.getParentIfKind(SyntaxKind.VariableDeclarationList)?.getParentIfKind(SyntaxKind.VariableStatement);
              if (stmt) {
                  stmt.remove();
                  changed = true;
              }
          }
      }
  }

  // Find remaining unresolved "propertyId" identifiers that aren't shorthand assignments
  // e.g. where: { propertyId: propertyId }
  const ids = file.getDescendantsOfKind(SyntaxKind.Identifier);
  for (const id of ids) {
      if (id.getText() === 'propertyId') {
          const parent = id.getParent();
          if (parent && parent.getKind() !== SyntaxKind.PropertyAssignment && 
              parent.getKind() !== SyntaxKind.ShorthandPropertyAssignment && 
              parent.getKind() !== SyntaxKind.VariableDeclaration &&
              parent.getKind() !== SyntaxKind.BindingElement &&
              parent.getKind() !== SyntaxKind.Parameter &&
              parent.getKind() !== SyntaxKind.PropertyAccessExpression) {
              
              // It's a dangling propertyId
              const hasReqProp = file.getFullText().includes('reqPropertyId');
              id.replaceWithText(hasReqProp ? '(reqPropertyId || ctx.propertyIds[0])' : 'ctx.propertyIds[0]');
              changed = true;
          }
      }
  }

  if (changed) {
    file.saveSync();
    console.log(`Fixed TS in ${file.getFilePath()}`);
  }
}
