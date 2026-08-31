import * as fs from 'fs';
import * as path from 'path';

const errors = fs.readFileSync('apps/web/pos-errors.txt', 'utf-8');
const filesToFix = new Set<string>();

for (const line of errors.split('\n')) {
    const match = line.match(/^(src\/app\/api\/v1\/pos\/[^:]+\.ts)/);
    if (match) {
        filesToFix.add(match[1]);
    }
}

for (const file of filesToFix) {
    const fullPath = path.join(process.cwd(), 'apps/web', file);
    if (!fs.existsSync(fullPath)) continue;
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // Remove injected reqPropertyId and reqOutletId
    content = content.replace(/\s*let reqPropertyId = [^\n]+\n\s*if \(reqPropertyId && !ctx\.propertyIds\.includes\(reqPropertyId\)\) [^\n]+\n/g, '\n');
    content = content.replace(/\s*const reqPropertyId = [^\n]+\n\s*if \(reqPropertyId && !ctx\.propertyIds\.includes\(reqPropertyId\)\) [^\n]+\n/g, '\n');
    
    content = content.replace(/\s*let reqOutletId = [^\n]+\n\s*if \(reqOutletId && !ctx\.outletIds\.includes\(reqOutletId\)\) [^\n]+\n/g, '\n');
    content = content.replace(/\s*const reqOutletId = [^\n]+\n\s*if \(reqOutletId && !ctx\.outletIds\.includes\(reqOutletId\)\) [^\n]+\n/g, '\n');
    
    // Remove wrongly injected ctx line
    content = content.replace(/\s*const ctx = await requireOrganizationContext\(\(session\.user as any\)\.id \|\| \(session as any\)\.user\.id\);\n/g, '\n');

    // Remove wrongly injected ctx from requireOrganizationContext import if it is now unused
    if (!content.includes('ctx.')) {
        content = content.replace(/import { requireOrganizationContext } from "@\/lib\/organization-access";\n/, '');
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`Fixed ${file}`);
}
