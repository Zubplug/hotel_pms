import { Project, SyntaxKind, VariableStatement, ObjectBindingPattern, PropertyAssignment } from 'ts-morph';
import * as path from 'path';

const moduleGlob = process.argv[2];
if (!moduleGlob) {
  console.error("Please provide a module glob, e.g. 'apps/web/src/app/api/v1/inventory/**/*.ts'");
  process.exit(1);
}

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles(moduleGlob);

for (const file of sourceFiles) {
  let changed = false;

  // 1. Add import for requireOrganizationContext if missing
  const hasImport = file.getImportDeclaration(dec => dec.getModuleSpecifierValue() === '@/lib/organization-access');
  if (!hasImport) {
    file.addImportDeclaration({
      moduleSpecifier: '@/lib/organization-access',
      namedImports: ['requireOrganizationContext']
    });
    changed = true;
  }

  // 2. Find legacy auth destructuring: const { role, propertyId, isSuperAdmin } = session.user as any;
  const variableDecs = file.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const dec of variableDecs) {
    const init = dec.getInitializer();
    if (init && init.getText().includes('session.user')) {
      const nameNode = dec.getNameNode();
      if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
        // It's destructuring session.user
        // Replace it with: const ctx = await requireOrganizationContext(session.user.id);
        const parent = dec.getParentIfKind(SyntaxKind.VariableDeclarationList);
        if (parent) {
          const statement = parent.getParentIfKind(SyntaxKind.VariableStatement);
          if (statement) {
            // Insert ctx right after the session extraction
            const insertIndex = statement.getChildIndex() + 1;
            const block = statement.getParentIfKind(SyntaxKind.Block);
            if (block) {
              block.insertStatements(insertIndex, `const ctx = await requireOrganizationContext(session.user.id);`);
              
              // We also need to keep role and isSuperAdmin if they were used, 
              // or rewrite the destructuring to extract from ctx.
              // For simplicity, let's just insert ctx and try to replace propertyId usage manually or via string replace later if needed.
              changed = true;
            }
          }
        }
      }
    }
  }

  // 3. Find and replace `assertPropertyAccess`
  const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    if (call.getExpression().getText() === 'assertPropertyAccess') {
      const args = call.getArguments();
      if (args.length >= 2) {
        const propId = args[1].getText();
        call.replaceWithText(`if (!ctx.propertyIds.includes(${propId})) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })`);
        changed = true;
      }
    } else if (call.getExpression().getText() === 'getUserPropertyIds') {
        call.replaceWithText(`ctx.propertyIds`);
        changed = true;
    }
  }

  if (changed) {
    file.saveSync();
    console.log(`Updated ${file.getFilePath()}`);
  }
}
