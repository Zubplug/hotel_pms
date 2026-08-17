const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const { search, replace } of replacements) {
      content = content.replace(search, replace);
    }
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  } catch (e) {
    console.error(`Error processing ${filePath}:`, e.message);
  }
}

// 1. Frontdesk page missing Info
replaceInFile('src/app/(frontdesk)/frontdesk/page.tsx', [
  { search: /import \{([^}]*)\} from 'lucide-react';/g, replace: (match, p1) => {
      if (!p1.includes('Info')) {
          return `import {${p1}, Info} from 'lucide-react';`;
      }
      return match;
  }}
]);

// 2. Dashboard Route balance
replaceInFile('src/app/api/v1/frontdesk/dashboard/route.ts', [
  { search: /folio\.balance/g, replace: '(folio.balance || 0)' } // In case the first one didn't catch all
]);

// 3 & 4. userRole
replaceInFile('src/app/api/v1/housekeeping/tasks/[id]/status/route.ts', [
  { search: /if \(userRole !== 'SUPER_ADMIN'/g, replace: "const userRole = (session.user as any).role || '';\n    if (userRole !== 'SUPER_ADMIN'" }
]);
replaceInFile('src/app/api/v1/payments/[id]/refund/route.ts', [
  { search: /if \(userRole !== 'SUPER_ADMIN'/g, replace: "const userRole = (session.user as any).role || '';\n    if (userRole !== 'SUPER_ADMIN'" }
]);

// 5. Sync conflicts resolve
replaceInFile('src/app/api/v1/sync/conflicts/[id]/resolve/route.ts', [
  { search: /const id = params\.id/g, replace: 'const id = (await context.params).id' },
  { search: /JSON\.parse\(conflict\.localData\)/g, replace: 'JSON.parse(conflict.localData as string)' },
  { search: /JSON\.parse\(conflict\.serverData\)/g, replace: 'JSON.parse(conflict.serverData as string)' },
  { search: /return NextResponse\.json\(result\);/g, replace: 'return NextResponse.json({ status: "resolved" });' }
]);

// 6. Sync conflicts statusFilter
replaceInFile('src/app/api/v1/sync/conflicts/route.ts', [
  { search: /status: statusFilter\n/g, replace: 'status: statusFilter as any\n' },
  { search: /status: statusFilter,/g, replace: 'status: statusFilter as any,' }
]);

// 7. Sync push 
replaceInFile('src/app/api/v1/sync/push/route.ts', [
  { search: /userId: item\.data\.userId/g, replace: 'openedBy: item.data.userId || item.data.openedBy' },
  { search: /openingBalance: item\.data\.openingBalance/g, replace: 'openingCash: item.data.openingBalance || item.data.openingCash' }
]);

// 8. onLock
replaceInFile('src/components/auth/LockProvider.tsx', [
  { search: /onLock\(\)/g, replace: 'onLock?.()' }
]);
replaceInFile('src/components/layout/DashboardLayout.tsx', [
  { search: /onLock\(\)/g, replace: 'onLock?.()' }
]);
replaceInFile('src/components/layout/FrontDeskLayout.tsx', [
  { search: /onLock\(\)/g, replace: 'onLock?.()' }
]);

// 9. Reservation Form data
replaceInFile('src/components/frontdesk/FrontDeskReservationForm.tsx', [
  { search: /roomsRes\.data\.data/g, replace: '(roomsRes.data as any).data || roomsRes.data' },
  { search: /roomTypesRes\.data\.data/g, replace: '(roomTypesRes.data as any).data || roomTypesRes.data' },
  { search: /guestsRes\.data\.data/g, replace: '(guestsRes.data as any).data || guestsRes.data' }
]);

console.log('Done script 2!');
