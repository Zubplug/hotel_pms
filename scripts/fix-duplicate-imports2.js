const fs = require('fs');
const path = require('path');

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules')) {
        results = results.concat(walkDir(file));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walkDir('apps/web/src/app');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  const lines = content.split('\n');
  const newLines = [];
  let found = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('import { requireOrganizationContext } from "@/lib/organization-access"') || 
        lines[i].includes("import { requireOrganizationContext } from '@/lib/organization-access'")) {
      if (!found) {
        newLines.push(lines[i]);
        found = true;
      } else {
        // duplicate! skip it
      }
    } else {
      newLines.push(lines[i]);
    }
  }
  
  const newContent = newLines.join('\n');
  if (content !== newContent) {
    console.log(`Removed duplicate in ${file}`);
    fs.writeFileSync(file, newContent);
  }
});
