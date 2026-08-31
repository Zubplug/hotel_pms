const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('apps/web/src/app/api/mobile/v1', function(filePath) {
  if (filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('requireOrganizationContext')) return;
    
    content = content.replace(/import\s*\{\s*resolveUser(?:,\s*getUserPropertyIds)?\s*\}\s*from\s*['"]@\/lib\/resolve-user['"];?/g, "import { resolveUser } from '@/lib/resolve-user';\nimport { requireOrganizationContext } from '@/lib/organization-access';");
    
    let original = content;
    
    // Pattern 1: extracting primaryPropertyId directly
    content = content.replace(/const\s+user\s*=\s*await\s+resolveUser\(req\);[\s\S]*?const\s+primaryPropertyId\s*=\s*allowedPropertyIds\[0\];?/g, 
      `const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const primaryPropertyId = ctx.propertyIds[0];
    if (!primaryPropertyId) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }`);

    // Pattern 2: extracting allowedPropertyIds
    content = content.replace(/const\s+user\s*=\s*await\s+resolveUser\(req\);[\s\S]*?const\s+allowedPropertyIds\s*=\s*user\.allowedProperties;?/g, 
      `const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const allowedPropertyIds = ctx.propertyIds;
    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }`);

    if (original !== content) {
      console.log('Updated: ' + filePath);
      fs.writeFileSync(filePath, content, 'utf8');
    } else {
      console.log('Skipped/No match: ' + filePath);
    }
  }
});
