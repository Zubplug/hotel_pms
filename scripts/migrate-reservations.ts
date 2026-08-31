import { Project, SyntaxKind, VariableDeclaration } from 'ts-morph';
import * as path from 'path';

const globs = [
    'apps/web/src/app/api/v1/reservations/**/*.ts',
    'apps/web/src/app/api/v1/guests/**/*.ts',
    'apps/web/src/app/api/v1/frontdesk/**/*.ts'
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

  // 1. Add import for requireOrganizationContext
  if (!file.getImportDeclaration(dec => dec.getModuleSpecifierValue() === '@/lib/organization-access')) {
    file.addImportDeclaration({
      moduleSpecifier: '@/lib/organization-access',
      namedImports: ['requireOrganizationContext']
    });
    changed = true;
  }
  
  if (!file.getImportDeclaration(dec => dec.getModuleSpecifierValue() === 'next/server')?.getNamedImports().some(n => n.getName() === 'NextResponse')) {
      const nextServerImport = file.getImportDeclaration(dec => dec.getModuleSpecifierValue() === 'next/server');
      if (nextServerImport) {
          if (!nextServerImport.getNamedImports().some(n => n.getName() === 'NextResponse')) {
             nextServerImport.addNamedImport('NextResponse');
             changed = true;
          }
      } else {
          file.addImportDeclaration({
              moduleSpecifier: 'next/server',
              namedImports: ['NextResponse']
          });
          changed = true;
      }
  }

  // 2. Safely process each function
  const funcs = file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const func of funcs) {
      const body = func.getBody();
      if (!body) continue;
      
      const varDecs = func.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      let sessionDecl: VariableDeclaration | null = null;
      for (const dec of varDecs) {
          if (dec.getName() === 'session' || (dec.getInitializer() && dec.getInitializer()!.getText().includes('auth()'))) {
              sessionDecl = dec;
              break;
          }
      }
      
      if (sessionDecl) {
          const stmt = sessionDecl.getParentIfKind(SyntaxKind.VariableDeclarationList)?.getParentIfKind(SyntaxKind.VariableStatement);
          if (stmt) {
              const block = stmt.getParentIfKind(SyntaxKind.Block);
              if (block) {
                  const stmts = block.getStatements();
                  let insertIdx = stmt.getChildIndex() + 1;
                  for (let i = insertIdx; i < stmts.length; i++) {
                      if (stmts[i].getKind() === SyntaxKind.IfStatement && stmts[i].getText().includes('session')) {
                          insertIdx = i + 1;
                          break;
                      }
                  }
                  
                  const hasCtx = stmts.some(s => s.getText().includes('const ctx ='));
                  if (!hasCtx) {
                      block.insertStatements(insertIdx, `const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);`);
                      changed = true;
                  }
              }
          }
      }
      
      const allVars = func.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      for (const dec of allVars) {
          if (dec.getInitializer()?.getText().includes('session.user')) {
              const nameNode = dec.getNameNode();
              if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
                  const elements = nameNode.getElements();
                  const remaining = elements.filter(e => e.getPropertyNameNode()?.getText() !== 'propertyId' && e.getName() !== 'propertyId');
                  if (remaining.length !== elements.length) {
                      const newText = '{ ' + remaining.map(e => e.getText()).join(', ') + ' }';
                      nameNode.replaceWithText(newText);
                      changed = true;
                  }
              }
          }
      }
  }

  // 3. Text replacements
  let text = file.getFullText();
  let textChanged = false;
  
  if (text.match(/where:\s*{\s*propertyId\s*}/)) {
     text = text.replace(/where:\s*{\s*propertyId\s*}/g, 'where: { propertyId: { in: ctx.propertyIds as string[] } }');
     textChanged = true;
  }
  if (text.match(/where:\s*{\s*id,\s*propertyId\s*}/)) {
     text = text.replace(/where:\s*{\s*id,\s*propertyId\s*}/g, 'where: { id, propertyId: { in: ctx.propertyIds as string[] } }');
     textChanged = true;
  }
  if (text.includes('propertyId, isActive')) {
     text = text.replace(/propertyId\s*,\s*isActive/g, 'propertyId: { in: ctx.propertyIds as string[] }, isActive');
     textChanged = true;
  }
  if (text.includes('assertPropertyAccess(user.propertyId,')) {
      text = text.replace(/assertPropertyAccess\(user\.propertyId,\s*([^)]+)\)/g, 'if (!ctx.propertyIds.includes($1)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })');
      textChanged = true;
  }
  if (text.includes('assertPropertyAccess(propertyId,')) {
      text = text.replace(/assertPropertyAccess\(propertyId,\s*([^)]+)\)/g, 'if (!ctx.propertyIds.includes($1)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })');
      textChanged = true;
  }
  if (text.includes('assertPropertyAccess(sessionPropertyId,')) {
      text = text.replace(/assertPropertyAccess\(sessionPropertyId,\s*([^)]+)\)/g, 'if (!ctx.propertyIds.includes($1)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })');
      textChanged = true;
  }

  const bodyRegex = /const\s+(body|data)\s*=\s*await\s+(?:req|request)\.json\(\)\s*;/g;
  text = text.replace(bodyRegex, (match, varName) => {
    return `${match}\n        const reqPropertyId = ${varName}?.propertyId;\n        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });`;
  });

  // Safely replace Prisma `data: { propertyId, ... }` shorthand assignments
  text = text.replace(/data:\s*{\s*propertyId\s*,/g, 'data: { propertyId: (typeof reqPropertyId !== "undefined" ? reqPropertyId : ctx.propertyIds[0]),');
  text = text.replace(/data:\s*{\s*([^,}]+,)*\s*propertyId\s*,/g, (match) => match.replace('propertyId', 'propertyId: (typeof reqPropertyId !== "undefined" ? reqPropertyId : ctx.propertyIds[0])'));

  
  if (text !== file.getFullText()) {
      textChanged = true;
  }

  if (textChanged) {
     file.replaceWithText(text);
     changed = true;
  }

  const varStmts = file.getDescendantsOfKind(SyntaxKind.VariableStatement);
  let reqPropCount = 0;
  for (const stmt of varStmts) {
      if (stmt.getText().includes('const reqPropertyId')) {
          reqPropCount++;
          if (reqPropCount > 1) {
              stmt.replaceWithText(stmt.getText().replace('const reqPropertyId', 'reqPropertyId'));
          } else {
              stmt.replaceWithText(stmt.getText().replace('const reqPropertyId', 'let reqPropertyId'));
          }
      }
  }

  if (changed) {
    file.saveSync();
    console.log(`Updated ${file.getFilePath()}`);
  }
}
