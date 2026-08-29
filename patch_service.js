const fs = require('fs');
const path = './apps/web/src/lib/services/shift-control-service.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix posSessionId -> sessionId for PosSettlement
content = content.replace(/posSessionId: shiftId/g, 'sessionId: shiftId');

// Fix status type errors by casting the objects to any, which is easiest for Prisma literal types
content = content.replace(/const updateData = \{([\s\S]*?)\};/g, 'const updateData: any = {$1};');

fs.writeFileSync(path, content);
