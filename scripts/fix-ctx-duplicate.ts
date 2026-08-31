import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('apps/web/src/app/api/v1/inventory/**/*.ts');

for (const file of sourceFiles) {
  let changed = false;

  const funcs = file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const func of funcs) {
      const varDecs = func.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
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
  }

  if (changed) {
    file.saveSync();
    console.log(`Fixed duplicates in ${file.getFilePath()}`);
  }
}
