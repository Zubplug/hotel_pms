const fs = require('fs');

function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, replacer(content));
}

// 1. Fix page.tsx Select onValueChange
replaceFile('./apps/web/src/app/(dashboard)/reports/shift/page.tsx', c => {
  let res = c.replace(/onValueChange=\{setDecision\}/g, 'onValueChange={(v) => setDecision(v || \'\')}');
  res = res.replace(/onValueChange=\{setReasonCode\}/g, 'onValueChange={(v) => setReasonCode(v || \'\')}');
  return res;
});

// 2. Fix approve route
replaceFile('./apps/web/src/app/api/v1/reports/shift/[shiftId]/approve/route.ts', c => {
  let res = c.replace(/const reasonCode: string = body\.reasonCode;/g, 'const reasonCode: string = body.reasonCode || \'\';');
  return res;
});

// 3. Fix shift reports API
replaceFile('./apps/web/src/app/api/v1/reports/shift/route.ts', c => {
  let res = c.replace(/shiftControlAudits: true/g, 'controlAudits: true');
  return res;
});

