import { Project, SyntaxKind, VariableDeclaration } from 'ts-morph';
import * as path from 'path';

const globs = [
    'apps/web/src/app/api/v1/pos/**/*.ts'
];

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

let sourceFiles: any[] = [];
globs.forEach(g => {
    sourceFiles = sourceFiles.concat(project.getSourceFiles(g));
});

for (const file of sourceFiles) {
  let changed = false;
  
  // 1. Fix "Cannot find name 'ctx'" and "Block-scoped variable 'ctx' used before its declaration"
  const funcs = file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const func of funcs) {
      const body = func.getBody();
      if (!body) continue;
      
      const stmts = body.getStatements();
      let sessionIndex = -1;
      let ctxIndex = -1;
      
      for (let i = 0; i < stmts.length; i++) {
          const text = stmts[i].getText();
          if (text.includes('const session =') || text.includes('const user =')) {
              sessionIndex = i;
          }
          if (text.includes('const ctx =')) {
              ctxIndex = i;
          }
      }
      
      // If there is no ctx but there is session/user, inject ctx!
      // But if there IS ctx, and it's before session/user or we need to remove duplicates
      
      if (ctxIndex !== -1) {
          // just remove all ctx and re-add them below session
          const ctxStmts = stmts.filter(s => s.getText().includes('const ctx = await requireOrganizationContext'));
          if (ctxStmts.length > 0) {
              for (const s of ctxStmts) {
                  try {
                      s.remove();
                  } catch (e) {}
              }
              changed = true;
          }
      }
  }
}

project.saveSync();
