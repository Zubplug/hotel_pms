import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('apps/web/src/app/api/v1/inventory/**/*.ts');

for (const file of sourceFiles) {
  let changed = false;

  const funcDecs = file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const func of funcDecs) {
      const text = func.getText();
      if (text.includes('session.user') && !text.includes('const ctx =')) {
          // Find where session.user is declared or accessed
          const varDecs = func.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
          let inserted = false;
          for (const dec of varDecs) {
              if (dec.getInitializer()?.getText().includes('session.user') && !inserted) {
                  const stmt = dec.getParentIfKind(SyntaxKind.VariableDeclarationList)?.getParentIfKind(SyntaxKind.VariableStatement);
                  if (stmt) {
                      const block = stmt.getParentIfKind(SyntaxKind.Block);
                      if (block) {
                          block.insertStatements(stmt.getChildIndex() + 1, 'const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);');
                          inserted = true;
                          changed = true;
                      }
                  }
              }
          }
      }
  }

  if (changed) {
    file.saveSync();
    console.log(`Added ctx to ${file.getFilePath()}`);
  }
}
