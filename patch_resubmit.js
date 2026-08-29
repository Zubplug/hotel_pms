const fs = require('fs');

function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, replacer(content));
}

// 1. Fix settle route 409 restriction to allow RETURNED
replaceFile('./apps/web/src/app/api/v1/pos/sessions/[sessionId]/settle/route.ts', c => {
  return c.replace(
    /if \(current\.status !== 'OPEN' && current\.status !== 'RECONCILIATION_REQUIRED'\) return NextResponse\.json\(\{ error: `Session cannot be settled from \$\{current\.status\}` \}, \{ status: 409 \}\);/,
    "if (current.status !== 'OPEN' && current.status !== 'RECONCILIATION_REQUIRED' && current.controlStatus !== 'RETURNED') return NextResponse.json({ error: `Session cannot be settled from ${current.status}` }, { status: 409 });"
  );
});

// 2. Fix push route to set SUBMITTED if RETURNED
replaceFile('./apps/web/src/app/api/v1/pos/sync/push/route.ts', c => {
  return c.replace(
    /status: 'CLOSED',/,
    "status: 'CLOSED',\n                          controlStatus: session.controlStatus === 'RETURNED' ? 'SUBMITTED' : session.controlStatus,"
  );
});

// 3. Fix shift-control-service.ts to use CLOSED instead of SETTLED
replaceFile('./apps/web/src/lib/services/shift-control-service.ts', c => {
  return c.replace(
    /\.\.\.\(type === 'POS' \? \{ status: 'SETTLED' \} : \{ status: 'UNDER_REVIEW' \}\)/,
    "...(type === 'POS' ? { status: 'CLOSED' } : { status: 'CLOSED' })"
  );
});

