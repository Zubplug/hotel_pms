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

// 1. src/app/api/v1/sync/conflicts/[id]/resolve/route.ts
replaceInFile('src/app/api/v1/sync/conflicts/[id]/resolve/route.ts', [
  { search: /\{ params \}: \{ params: \{ id: string \} \}/g, replace: 'context: { params: Promise<{ id: string }> }' },
  { search: /const id = params\.id/g, replace: 'const id = (await context.params).id' },
  { search: /JSON\.parse\(conflict\.localData\)/g, replace: 'JSON.parse(conflict.localData as string)' },
  { search: /JSON\.parse\(conflict\.serverData\)/g, replace: 'JSON.parse(conflict.serverData as string)' },
  { search: /return NextResponse\.json\(result\);/g, replace: 'return NextResponse.json({ status: "resolved" });' }
]);

// 2. Dashboard
replaceInFile('src/app/(dashboard)/dashboard/page.tsx', [
  { search: /import \{([^}]*)\} from 'recharts';/, replace: "import {$1, Tooltip} from 'recharts';" }
]);

// 3. Room Types
replaceInFile('src/app/(dashboard)/room-types/page.tsx', [
  { search: /import RoomTypeForm from '@\/components\/admin\/RoomTypeForm';\n/g, replace: '' },
  { search: /import \{ RoomTypeForm \} from '@\/components\/admin\/RoomTypeForm';\n/g, replace: '' }
]);

// 4. Frontdesk page
replaceInFile('src/app/(frontdesk)/frontdesk/page.tsx', [
  { search: /UserCheck, UserMinus, Search, Filter/g, replace: 'UserCheck, UserMinus, Search, Filter, Info' }
]);

// 5. POS Page
replaceInFile('src/app/(pos)/pos/page.tsx', [
  { search: /const propertyId = session\?\.user\?\.propertyId/g, replace: 'const propertyId = (session?.user as any)?.propertyId' }
]);

// 6. POS Settlement Page
replaceInFile('src/app/(pos)/settlement/page.tsx', [
  { search: /s\.userId/g, replace: 's.openedBy' },
  { search: /session\.userId/g, replace: 'session.openedBy' }
]);

// 7. API Frontdesk Dashboard
replaceInFile('src/app/api/v1/frontdesk/dashboard/route.ts', [
  { search: /folio\.balance/g, replace: '(folio.balance ?? 0)' }
]);

// 8. Housekeeping Status API
replaceInFile('src/app/api/v1/housekeeping/tasks/[id]/status/route.ts', [
  { search: /if \(userRole !== 'SUPER_ADMIN'/g, replace: "const userRole = (session.user as any).role || '';\n    if (userRole !== 'SUPER_ADMIN'" }
]);

// 9. Payments Refund API
replaceInFile('src/app/api/v1/payments/[id]/refund/route.ts', [
  { search: /if \(userRole !== 'SUPER_ADMIN'/g, replace: "const userRole = (session.user as any).role || '';\n    if (userRole !== 'SUPER_ADMIN'" }
]);

// 10. Sync Conflicts Route
replaceInFile('src/app/api/v1/sync/conflicts/route.ts', [
  { search: /status: statusFilter/g, replace: 'status: statusFilter as any' }
]);

// 11. Sync Push Route
replaceInFile('src/app/api/v1/sync/push/route.ts', [
  { search: /userId: item\.data\.userId/g, replace: 'openedBy: item.data.userId || item.data.openedBy' },
  { search: /openingBalance: item\.data\.openingBalance/g, replace: 'openingCash: item.data.openingBalance || item.data.openingCash' }
]);

// 12. LockProvider
replaceInFile('src/components/auth/LockProvider.tsx', [
  { search: /onLock\(\)/g, replace: 'onLock?.()' }
]);

// 13. DashboardLayout
replaceInFile('src/components/layout/DashboardLayout.tsx', [
  { search: /session\?\.user\?\.isSuperAdmin/g, replace: '(session?.user as any)?.isSuperAdmin' },
  { search: /onLock\(\)/g, replace: 'onLock?.()' }
]);

// 14. FrontDeskLayout
replaceInFile('src/components/layout/FrontDeskLayout.tsx', [
  { search: /onLock\(\)/g, replace: 'onLock?.()' }
]);

// 15. StaffSwitchPad
replaceInFile('src/components/pos/StaffSwitchPad.tsx', [
  { search: /session\?\.user\?\.propertyId/g, replace: '(session?.user as any)?.propertyId' }
]);

// 16. FrontDeskReservationForm
replaceInFile('src/components/frontdesk/FrontDeskReservationForm.tsx', [
  { search: /roomsRes\.data\.data/g, replace: '(roomsRes.data as any).data || roomsRes.data' },
  { search: /roomTypesRes\.data\.data/g, replace: '(roomTypesRes.data as any).data || roomTypesRes.data' },
  { search: /guestsRes\.data\.data/g, replace: '(guestsRes.data as any).data || guestsRes.data' }
]);

// 17. DataProviderContext
replaceInFile('src/lib/desktop/DataProviderContext.tsx', [
  { search: /<DataProviderContext\.Provider value=\{\{ provider, isDesktopMode, isOnline, syncStatus \}\}>/g, replace: '<DataProviderContext.Provider value={{ provider, isDesktopMode, isOnline, syncStatus, pos: provider.pos }}>' }
]);

// 18. OnlineDataProvider (Signature mismatch)
replaceInFile('src/lib/desktop/DataProvider.ts', [
  { search: /resolveTicket: \(ticketId: string\) => Promise<void>;/g, replace: 'resolveTicket: (ticketId: string, resolution?: any) => Promise<any>;' }
]);
replaceInFile('src/lib/desktop/OnlineDataProvider.ts', [
  { search: /resolveTicket: async \(ticketId, resolution\) =>/g, replace: 'resolveTicket: async (ticketId: string, resolution?: any) =>' }
]);

console.log('Done!');
