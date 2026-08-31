const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');

const project = new Project({
  tsConfigFilePath: path.join(__dirname, '../apps/web/tsconfig.json'),
});

const sourceFiles = project.getSourceFiles('apps/web/src/app/api/v1/**/*.ts').filter(f => 
  !f.getFilePath().includes('/inventory/') &&
  !f.getFilePath().includes('/rooms/') &&
  !f.getFilePath().includes('/properties/') &&
  !f.getFilePath().includes('/reservations/') &&
  !f.getFilePath().includes('/guests/') &&
  !f.getFilePath().includes('/frontdesk/') &&
  !f.getFilePath().includes('/pos/')
);

for (const file of sourceFiles) {
  let changed = false;
  let text = file.getFullText();
  
  if (text.includes('getUserPropertyIds') || text.includes('assertPropertyAccess')) {
    
    // Add import
    if (!text.includes('requireOrganizationContext')) {
      text = `import { requireOrganizationContext } from '@/lib/organization-access';\n` + text;
      changed = true;
    }

    if (!text.includes('NextResponse')) {
      text = `import { NextResponse } from 'next/server';\n` + text;
      changed = true;
    }

    // Replace getUserPropertyIds
    text = text.replace(/await\s+getUserPropertyIds\(([^)]+)\)/g, '(await requireOrganizationContext($1)).propertyIds');
    
    // Replace assertPropertyAccess
    text = text.replace(/await\s+assertPropertyAccess\(([^,]+),\s*([^)]+)\)\s*;/g, 'if (!(await requireOrganizationContext($1)).propertyIds.includes($2)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });');
    
    // Sometimes it's inline in a try/catch or without await
    text = text.replace(/assertPropertyAccess\(([^,]+),\s*([^)]+)\)/g, '(await requireOrganizationContext($1)).propertyIds.includes($2) ? true : (() => { throw new Error("Forbidden") })()');
    
    changed = true;
  }
  
  if (changed) {
    file.replaceWithText(text);
    file.saveSync();
    console.log(`Updated ${file.getFilePath()}`);
  }
}
