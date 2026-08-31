import { Project } from 'ts-morph';
import * as path from 'path';

const moduleGlob = 'apps/web/src/app/api/v1/inventory/**/*.ts';

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles(moduleGlob);

for (const file of sourceFiles) {
  let content = file.getFullText();
  let changed = false;

  // 1. Remove propertyId from session.user destructuring
  const regexDestructure = /const\s*{\s*([^}]*?)\s*}\s*=\s*session\.user\s+as\s+any\s*;/g;
  content = content.replace(regexDestructure, (match, inner) => {
    changed = true;
    const parts = inner.split(',').map((s: string) => s.trim()).filter((s: string) => s !== 'propertyId');
    if (parts.length === 0) return '';
    return `const { ${parts.join(', ')} } = session.user as any;`;
  });

  // 2. Add validation for propertyId in POST/PUT bodies
  const bodyRegex = /const\s+(?:body|data)\s*=\s*await\s+request\.json\(\)\s*;/g;
  content = content.replace(bodyRegex, (match) => {
    changed = true;
    return `${match}\n        const reqPropertyId = body?.propertyId || data?.propertyId;\n        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });`;
  });

  // 3. For GET queries, where we used { propertyId, ... } -> { propertyId: { in: ctx.propertyIds }, ... }
  if (content.includes('propertyId, isActive')) {
     content = content.replace(/propertyId\s*,\s*isActive/g, 'propertyId: { in: ctx.propertyIds }, isActive');
     changed = true;
  }
  if (content.match(/where:\s*{\s*propertyId\s*}/)) {
     content = content.replace(/where:\s*{\s*propertyId\s*}/g, 'where: { propertyId: { in: ctx.propertyIds } }');
     changed = true;
  }
  if (content.includes('propertyId: propertyId')) {
     content = content.replace(/propertyId: propertyId/g, 'propertyId: { in: ctx.propertyIds }');
     changed = true;
  }

  // Fallback replace propertyId in prisma creates
  // We can't safely do this with simple regex. Let the compiler complain.

  if (changed) {
    file.replaceWithText(content);
    file.saveSync();
    console.log(`Migrated ${file.getFilePath()}`);
  }
}
