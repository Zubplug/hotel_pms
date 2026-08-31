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
  const importRegex = /import\s*\{\s*requireOrganizationContext\s*\}\s*from\s*'@\/lib\/organization-access';/g;
  let matches = [...content.matchAll(importRegex)];
  
  if (matches.length > 1) {
    console.log(`Fixing duplicates in ${file}`);
    let newContent = content.substring(0, matches[1].index);
    let rest = content.substring(matches[1].index);
    rest = rest.replace(importRegex, '');
    rest = rest.replace(/^\s*\n/gm, '');
    fs.writeFileSync(file, newContent + rest);
  }
});
