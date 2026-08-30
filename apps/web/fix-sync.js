const fs = require('fs');
let code = fs.readFileSync('src/app/api/v1/sync/push/frontdesk/route.ts', 'utf8');

if (!code.includes('const authoritativeBusinessDate = property.businessDate || getPropertyBusinessDate')) {
    code = code.replace(
      "    const terminals = await prisma.posTerminal.findMany({",
      "    const authoritativeBusinessDate = property.businessDate || getPropertyBusinessDate('Africa/Lagos', new Date());\n\n    const terminals = await prisma.posTerminal.findMany({"
    );
}

code = code.replace(/new Date\(payload\.originalBusinessDate \|\| payload\.businessDate \|\| sessionBusinessDate \|\| new Date\(\)\)/g, 'authoritativeBusinessDate');

// specifically target businessDate: new Date()
code = code.replace(/businessDate:\s*new Date\(\)/g, 'businessDate: authoritativeBusinessDate');

// specifically target line 991
code = code.replace(/businessDate: property\.businessDate \|\| getPropertyBusinessDate\(property\.timezone\)/g, 'businessDate: authoritativeBusinessDate');

fs.writeFileSync('src/app/api/v1/sync/push/frontdesk/route.ts', code);
console.log('Done!');
